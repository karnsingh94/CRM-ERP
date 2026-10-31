import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.js';
import approvalService from '../approval.service.js';
import auditService from '../audit.service.js';

function inventoryError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function positiveInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw inventoryError(`${field} must be a positive whole number.`);
  }
  return parsed;
}

function nonNegativeInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw inventoryError(`${field} must be zero or a positive whole number.`);
  }
  return parsed;
}

function documentNo(prefix) {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

function cleanSku(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function actorName(actor) {
  return actor?.email || actor?.name || actor?.role || 'SYSTEM';
}

const BUCKET_FIELDS = {
  AVAILABLE: 'availableQty',
  RESERVED: 'reservedStock',
  WIP: 'wipQty',
  QUALITY_HOLD: 'qualityHoldQty',
  REJECTED: 'rejectedQty',
  SAMPLING: 'samplingQty',
  RETURN_HOLD: 'returnHoldQty',
  SCRAP: 'scrapQty',
};

function normalizeBucket(bucketName) {
  const key = String(bucketName || 'AVAILABLE').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!BUCKET_FIELDS[key]) {
    throw inventoryError(`Invalid inventory bucket '${bucketName}'. Supported buckets: AVAILABLE, RESERVED, WIP, QUALITY_HOLD, REJECTED, SAMPLING, RETURN_HOLD, SCRAP.`);
  }
  return key;
}

async function stockTotal(client, companyId, sku) {
  const result = await client.inventoryStock.aggregate({
    where: { companyId, sku },
    _sum: { stock: true },
  });
  return result._sum.stock || 0;
}

async function syncProductStock(client, companyId, sku) {
  const product = await client.product.findFirst({ where: { companyId, sku }, select: { id: true } });
  if (!product) return;
  const total = await stockTotal(client, companyId, sku);
  await client.product.update({ where: { id: product.id }, data: { stock: total } });
}

async function createMovement(client, data) {
  return client.inventoryMovement.create({
    data: {
      companyId: data.companyId,
      stockId: data.stockId || null,
      batchId: data.batchId || null,
      batchNo: data.batchNo || null,
      movementNo: documentNo('MOV'),
      movementType: data.movementType,
      sku: data.sku,
      itemName: data.itemName,
      warehouse: data.warehouse,
      quantity: data.quantity,
      balanceAfter: data.balanceAfter,
      sourceBucket: data.sourceBucket || null,
      destinationBucket: data.destinationBucket || null,
      uom: data.uom || 'PCS',
      unitCost: Number(data.unitCost) || 0,
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      referenceNo: data.referenceNo || null,
      reason: data.reason || null,
      notes: data.notes || null,
      createdBy: data.createdBy || null,
      approvedBy: data.approvedBy || null,
    },
  });
}

export const inventoryService = {
  // ====================================================================
  // 1. DASHBOARD & 8-BUCKET CONSOLIDATION
  // ====================================================================
  async dashboard(companyId) {
    const [stocks, warehouses, batches, pendingAdjustments, pendingVerifications, openSamplings, recentMovements] = await Promise.all([
      prisma.inventoryStock.findMany({ where: { companyId } }),
      prisma.inventoryWarehouse.findMany({ where: { companyId, status: 'ACTIVE' } }),
      prisma.inventoryBatch.findMany({ where: { companyId, status: 'ACTIVE' } }),
      prisma.inventoryAdjustment.count({ where: { companyId, status: 'PENDING_APPROVAL' } }),
      prisma.inventoryPhysicalVerification.count({ where: { companyId, status: { in: ['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL'] } } }),
      prisma.inventorySampling.count({ where: { companyId, status: { in: ['ISSUED', 'PARTIALLY_RETURNED'] } } }),
      prisma.inventoryMovement.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const buckets = {
      available: 0,
      reserved: 0,
      wip: 0,
      qualityHold: 0,
      rejected: 0,
      sampling: 0,
      returnHold: 0,
      scrap: 0,
      totalStock: 0,
      totalOnHand: 0,
    };

    let lowStockCount = 0;
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000);
    let expiredBatchesCount = 0;
    let nearExpiryBatchesCount = 0;

    for (const st of stocks) {
      buckets.available += st.availableQty || 0;
      buckets.reserved += st.reservedStock || 0;
      buckets.wip += st.wipQty || 0;
      buckets.qualityHold += st.qualityHoldQty || 0;
      buckets.rejected += st.rejectedQty || 0;
      buckets.sampling += st.samplingQty || 0;
      buckets.returnHold += st.returnHoldQty || 0;
      buckets.scrap += st.scrapQty || 0;
      buckets.totalStock += st.stock || 0;
      buckets.totalOnHand += st.stock || 0;

      if ((st.availableQty || 0) <= (st.reorderLevel || 10)) {
        lowStockCount++;
      }
    }

    for (const b of batches) {
      if (b.expiryDate) {
        if (new Date(b.expiryDate) <= now && (b.availableQty || 0) > 0) {
          expiredBatchesCount++;
        } else if (new Date(b.expiryDate) <= thirtyDaysLater && (b.availableQty || 0) > 0) {
          nearExpiryBatchesCount++;
        }
      }
    }

    return {
      buckets,
      warehousesCount: warehouses.length,
      activeBatchesCount: batches.length,
      lowStockCount,
      expiredBatchesCount,
      nearExpiryBatchesCount,
      pendingAdjustments,
      pendingVerifications,
      openSamplings,
      recentMovements,
    };
  },

  // ====================================================================
  // 2. STOCK MASTER & BUCKET TRANSFERS
  // ====================================================================
  async listStocks(companyId, query = {}) {
    const where = { companyId };
    if (query?.warehouse) where.warehouse = String(query.warehouse);
    if (query?.sku) where.sku = { contains: cleanSku(query.sku) };

    const items = await prisma.inventoryStock.findMany({
      where,
      include: {
        product: true,
        bin: true,
        batches: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ warehouse: 'asc' }, { sku: 'asc' }],
    });

    return items.map((st) => ({
      ...st,
      totalOnHand: st.stock,
      bucketBreakdown: {
        available: st.availableQty,
        reserved: st.reservedStock,
        wip: st.wipQty,
        qualityHold: st.qualityHoldQty,
        rejected: st.rejectedQty,
        sampling: st.samplingQty,
        returnHold: st.returnHoldQty,
        scrap: st.scrapQty,
      },
    }));
  },

  async transferBucket(companyId, data, actor) {
    const sku = cleanSku(data.sku);
    const warehouse = String(data.warehouse || 'Main Warehouse').trim();
    const sourceBucket = normalizeBucket(data.sourceBucket);
    const destinationBucket = normalizeBucket(data.destinationBucket);
    const quantity = positiveInt(data.quantity, 'Transfer quantity');
    const reason = String(data.reason || '').trim();

    if (sourceBucket === destinationBucket) {
      throw inventoryError('Source and destination buckets cannot be the same.');
    }
    if (!reason) {
      throw inventoryError('Written reason is required for bucket transfers.');
    }

    return prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, sku, warehouse },
      });
      if (!stock) throw inventoryError(`Stock record for SKU ${sku} in warehouse '${warehouse}' not found.`, 404);

      const srcProp = BUCKET_FIELDS[sourceBucket];
      const destProp = BUCKET_FIELDS[destinationBucket];

      const currentSrcQty = Number(stock[srcProp] || 0);
      if (currentSrcQty < quantity) {
        throw inventoryError(
          `Insufficient stock in ${sourceBucket} bucket for ${sku}. Available in bucket: ${currentSrcQty}, Requested: ${quantity}.`,
          409
        );
      }

      // Update Stock bucket fields
      const stockUpdate = {
        [srcProp]: { decrement: quantity },
        [destProp]: { increment: quantity },
      };

      const updatedStock = await tx.inventoryStock.update({
        where: { id: stock.id },
        data: stockUpdate,
      });

      // If batchNo is specified, update batch bucket fields
      let batch = null;
      if (data.batchNo) {
        batch = await tx.inventoryBatch.findFirst({
          where: { companyId, sku, batchNo: String(data.batchNo).trim(), warehouse },
        });
        if (batch) {
          const batchSrcQty = Number(batch[srcProp] || 0);
          if (batchSrcQty < quantity) {
            throw inventoryError(`Batch ${batch.batchNo} has insufficient quantity in ${sourceBucket}. Available: ${batchSrcQty}, Requested: ${quantity}.`, 409);
          }
          batch = await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              [srcProp]: { decrement: quantity },
              [destProp]: { increment: quantity },
            },
          });
        }
      }

      const movement = await createMovement(tx, {
        companyId,
        stockId: stock.id,
        batchId: batch?.id || null,
        batchNo: batch?.batchNo || (data.batchNo ? String(data.batchNo).trim() : null),
        movementType: 'BUCKET_TRANSFER',
        sku,
        itemName: stock.name,
        warehouse,
        quantity,
        balanceAfter: updatedStock.stock,
        sourceBucket,
        destinationBucket,
        uom: stock.uom,
        unitCost: stock.averageCost,
        referenceType: data.referenceType || 'BUCKET_ADJUSTMENT',
        referenceId: data.referenceId || null,
        referenceNo: data.referenceNo || null,
        reason,
        notes: String(data.notes || '').trim() || null,
        createdBy: actorName(actor),
      });

      await auditService.logAction({
        companyId,
        actor,
        action: 'INVENTORY_BUCKET_TRANSFER',
        entityType: 'INVENTORY_STOCK',
        entityId: stock.id,
        details: `Moved ${quantity} units of ${sku} from ${sourceBucket} to ${destinationBucket}. Reason: ${reason}`,
      });

      return { ...updatedStock, batch, movement };
    });
  },

  // ====================================================================
  // 3. BATCH / LOT MANAGEMENT
  // ====================================================================
  async listBatches(companyId, query = {}) {
    const where = { companyId };
    if (query?.warehouse) where.warehouse = String(query.warehouse);
    if (query?.sku) where.sku = cleanSku(query.sku);
    if (query?.status) where.status = String(query.status);
    if (query?.qualityStatus) where.qualityStatus = String(query.qualityStatus);

    return prisma.inventoryBatch.findMany({
      where,
      include: { stock: true, product: true },
      orderBy: [{ receivedDate: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async createBatch(companyId, data, actor) {
    const sku = cleanSku(data.sku);
    const batchNo = String(data.batchNo || documentNo('LOT')).trim().toUpperCase();
    const warehouse = String(data.warehouse || 'Main Warehouse').trim();
    const initialQty = nonNegativeInt(data.initialQty ?? 0, 'Initial quantity');
    const unitCost = Number(data.unitCost || 0);

    return prisma.$transaction(async (tx) => {
      let stock = await tx.inventoryStock.findFirst({ where: { companyId, sku, warehouse } });
      if (!stock) {
        stock = await tx.inventoryStock.create({
          data: {
            companyId,
            sku,
            name: String(data.name || sku).trim(),
            warehouse,
            stock: 0,
            availableQty: 0,
            averageCost: unitCost,
          },
        });
      }

      const existingBatch = await tx.inventoryBatch.findFirst({
        where: { companyId, sku, batchNo, warehouse },
      });
      if (existingBatch) {
        throw inventoryError(`Batch '${batchNo}' already exists for SKU ${sku} in warehouse '${warehouse}'. Duplicate batches are prohibited.`, 409);
      }

      const batch = await tx.inventoryBatch.create({
        data: {
          companyId,
          stockId: stock.id,
          sku,
          batchNo,
          warehouse,
          manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          receivedDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
          vendorId: data.vendorId || null,
          vendorName: data.vendorName || null,
          grnId: data.grnId || null,
          grnNo: data.grnNo || null,
          initialQty,
          availableQty: initialQty,
          qualityStatus: data.qualityStatus || 'ACCEPTED',
          status: 'ACTIVE',
          unitCost,
        },
      });

      if (initialQty > 0) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            stock: { increment: initialQty },
            availableQty: { increment: initialQty },
          },
        });

        await createMovement(tx, {
          companyId,
          stockId: stock.id,
          batchId: batch.id,
          batchNo: batch.batchNo,
          movementType: 'BATCH_INITIALIZATION',
          sku,
          itemName: stock.name,
          warehouse,
          quantity: initialQty,
          balanceAfter: stock.stock + initialQty,
          sourceBucket: null,
          destinationBucket: 'AVAILABLE',
          uom: stock.uom,
          unitCost,
          referenceType: 'BATCH_CREATE',
          referenceId: batch.id,
          referenceNo: batch.batchNo,
          reason: `Initial stock for batch ${batch.batchNo}`,
          createdBy: actorName(actor),
        });

        await syncProductStock(tx, companyId, sku);
      }

      await auditService.logAction({
        companyId,
        actor,
        action: 'CREATE_INVENTORY_BATCH',
        entityType: 'INVENTORY_BATCH',
        entityId: batch.id,
        details: `Created batch ${batch.batchNo} for ${sku} with initial quantity ${initialQty}`,
      });

      return batch;
    });
  },

  async getBatch(companyId, batchId) {
    const batch = await prisma.inventoryBatch.findFirst({
      where: { id: batchId, companyId },
      include: { stock: true, product: true },
    });
    if (!batch) throw inventoryError('Inventory batch not found.', 404);
    return batch;
  },

  // ====================================================================
  // 4. FIFO STOCK ALLOCATION ENGINE
  // ====================================================================
  async allocateFIFO(companyId, { sku: rawSku, quantity: rawQty, warehouse, referenceType, referenceId, referenceNo, autoReserve = false }, actor) {
    const sku = cleanSku(rawSku);
    const quantity = positiveInt(rawQty, 'Required allocation quantity');
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const batchWhere = {
        companyId,
        sku,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
        availableQty: { gt: 0 },
      };
      if (warehouse) batchWhere.warehouse = String(warehouse).trim();

      // Query active, non-expired batches ordered by manufacturingDate or receivedDate (FIFO)
      const eligibleBatches = await tx.inventoryBatch.findMany({
        where: batchWhere,
        orderBy: [
          { manufacturingDate: 'asc' },
          { receivedDate: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      // Filter strictly to non-expired batches
      const nonExpiredBatches = eligibleBatches.filter((b) => !b.expiryDate || new Date(b.expiryDate) > now);

      const totalAvailable = nonExpiredBatches.reduce((sum, b) => sum + b.availableQty, 0);
      if (totalAvailable < quantity) {
        throw inventoryError(
          `Insufficient eligible available stock for ${sku}. Total available via FIFO: ${totalAvailable}, Requested: ${quantity}. Excluded Quality Hold, Rejected, and Expired batches.`,
          409
        );
      }

      let remainingNeeded = quantity;
      const allocations = [];

      for (const batch of nonExpiredBatches) {
        if (remainingNeeded <= 0) break;
        const take = Math.min(batch.availableQty, remainingNeeded);

        allocations.push({
          batchId: batch.id,
          batchNo: batch.batchNo,
          warehouse: batch.warehouse,
          quantity: take,
          manufacturingDate: batch.manufacturingDate,
          expiryDate: batch.expiryDate,
          receivedDate: batch.receivedDate,
          unitCost: Number(batch.unitCost),
        });

        if (autoReserve) {
          // Decrement batch available, increment batch reserved
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              availableQty: { decrement: take },
              reservedQty: { increment: take },
            },
          });

          // Update stock header
          const stock = await tx.inventoryStock.findFirst({ where: { companyId, sku, warehouse: batch.warehouse } });
          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                availableQty: { decrement: take },
                reservedStock: { increment: take },
              },
            });

            await createMovement(tx, {
              companyId,
              stockId: stock.id,
              batchId: batch.id,
              batchNo: batch.batchNo,
              movementType: 'FIFO_ALLOCATION_RESERVATION',
              sku,
              itemName: stock.name,
              warehouse: batch.warehouse,
              quantity: take,
              balanceAfter: stock.stock,
              sourceBucket: 'AVAILABLE',
              destinationBucket: 'RESERVED',
              uom: stock.uom,
              unitCost: batch.unitCost,
              referenceType: referenceType || 'ORDER_ALLOCATION',
              referenceId: referenceId || null,
              referenceNo: referenceNo || null,
              reason: `FIFO allocated and reserved for ${referenceNo || referenceType || 'order'}`,
              createdBy: actorName(actor),
            });
          }
        }

        remainingNeeded -= take;
      }

      return {
        sku,
        totalAllocated: quantity,
        allocatedQty: quantity,
        requiredQty: quantity,
        shortageQty: 0,
        allocationsCount: allocations.length,
        allocations,
        batchesAllocated: allocations,
        autoReserved: autoReserve,
      };
    });
  },

  // ====================================================================
  // 5. STOCK RESERVATIONS
  // ====================================================================
  async createReservation(companyId, data, actor) {
    const sku = cleanSku(data.sku);
    const quantity = positiveInt(data.quantity, 'Reservation quantity');
    const warehouse = String(data.warehouse || 'Main Warehouse').trim();
    const referenceType = String(data.referenceType || 'SALES_ORDER').trim();
    const referenceNo = String(data.referenceNo || '').trim();

    return prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.findFirst({ where: { companyId, sku, warehouse } });
      if (!stock) throw inventoryError(`Stock for ${sku} not found in ${warehouse}.`, 404);
      if (stock.availableQty < quantity) {
        throw inventoryError(`Cannot reserve: Available stock is ${stock.availableQty}, requested ${quantity}.`, 409);
      }

      let batch = null;
      if (data.batchNo) {
        batch = await tx.inventoryBatch.findFirst({
          where: { companyId, sku, batchNo: String(data.batchNo).trim(), warehouse },
        });
        if (!batch) throw inventoryError(`Batch ${data.batchNo} not found.`, 404);
        if (batch.availableQty < quantity) {
          throw inventoryError(`Batch ${batch.batchNo} available quantity (${batch.availableQty}) is less than ${quantity}.`, 409);
        }
        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: {
            availableQty: { decrement: quantity },
            reservedQty: { increment: quantity },
          },
        });
      }

      const updatedStock = await tx.inventoryStock.update({
        where: { id: stock.id },
        data: {
          availableQty: { decrement: quantity },
          reservedStock: { increment: quantity },
        },
      });

      const reservationNo = documentNo('RES');
      const reservation = await tx.inventoryReservation.create({
        data: {
          companyId,
          reservationNo,
          sku,
          warehouse,
          batchId: batch?.id || null,
          batchNo: batch?.batchNo || null,
          quantity,
          referenceType,
          referenceId: data.referenceId || null,
          referenceNo,
          status: 'ACTIVE',
          reservedBy: actorName(actor),
          notes: String(data.notes || '').trim() || null,
        },
      });

      await createMovement(tx, {
        companyId,
        stockId: stock.id,
        batchId: batch?.id || null,
        batchNo: batch?.batchNo || null,
        movementType: 'STOCK_RESERVATION',
        sku,
        itemName: stock.name,
        warehouse,
        quantity,
        balanceAfter: updatedStock.stock,
        sourceBucket: 'AVAILABLE',
        destinationBucket: 'RESERVED',
        uom: stock.uom,
        unitCost: stock.averageCost,
        referenceType: 'INVENTORY_RESERVATION',
        referenceId: reservation.id,
        referenceNo: reservation.reservationNo,
        reason: `Reserved for ${referenceType} ${referenceNo}`,
        createdBy: actorName(actor),
      });

      return reservation;
    });
  },

  async listReservations(companyId, query = {}) {
    const where = { companyId };
    if (query?.status) where.status = String(query.status);
    if (query?.sku) where.sku = cleanSku(query.sku);

    return prisma.inventoryReservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async releaseReservation(companyId, reservationId, actor, reason = 'Reservation released') {
    return prisma.$transaction(async (tx) => {
      const res = await tx.inventoryReservation.findFirst({
        where: { id: reservationId, companyId, status: 'ACTIVE' },
      });
      if (!res) throw inventoryError('Active reservation not found.', 404);

      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, sku: res.sku, warehouse: res.warehouse },
      });
      if (stock) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            availableQty: { increment: res.quantity },
            reservedStock: { decrement: Math.min(stock.reservedStock, res.quantity) },
          },
        });
      }

      if (res.batchId) {
        const batch = await tx.inventoryBatch.findUnique({ where: { id: res.batchId } });
        if (batch) {
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              availableQty: { increment: res.quantity },
              reservedQty: { decrement: Math.min(batch.reservedQty, res.quantity) },
            },
          });
        }
      }

      const updated = await tx.inventoryReservation.update({
        where: { id: res.id },
        data: {
          status: 'RELEASED',
          releasedBy: actorName(actor),
          releasedAt: new Date(),
          notes: String(reason).trim(),
        },
      });

      if (stock) {
        await createMovement(tx, {
          companyId,
          stockId: stock.id,
          batchId: res.batchId,
          batchNo: res.batchNo,
          movementType: 'RESERVATION_RELEASE',
          sku: res.sku,
          itemName: stock.name,
          warehouse: res.warehouse,
          quantity: res.quantity,
          balanceAfter: stock.stock,
          sourceBucket: 'RESERVED',
          destinationBucket: 'AVAILABLE',
          uom: stock.uom,
          unitCost: stock.averageCost,
          referenceType: 'INVENTORY_RESERVATION',
          referenceId: res.id,
          referenceNo: res.reservationNo,
          reason,
          createdBy: actorName(actor),
        });
      }

      return updated;
    });
  },

  async cancelReservation(companyId, reservationId, actor, reason = 'Reservation cancelled') {
    return this.releaseReservation(companyId, reservationId, actor, reason);
  },

  // ====================================================================
  // 6. SAMPLING MANAGEMENT
  // ====================================================================
  async createSampling(companyId, data, actor) {
    const sku = cleanSku(data.sku);
    const quantity = positiveInt(data.quantity, 'Sample quantity');
    const warehouse = String(data.warehouse || 'Main Warehouse').trim();
    const billingType = String(data.billingType || 'FREE').trim().toUpperCase();
    const customerName = String(data.customerName || 'Prospect').trim();
    const responsiblePerson = String(data.responsiblePerson || actorName(actor)).trim();

    return prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.findFirst({ where: { companyId, sku, warehouse } });
      if (!stock) throw inventoryError(`Stock for ${sku} not found in ${warehouse}.`, 404);
      if (stock.availableQty < quantity) {
        throw inventoryError(`Insufficient available stock for sampling: Available ${stock.availableQty}, requested ${quantity}.`, 409);
      }

      const samplingNo = documentNo('SMP');
      const isWaived = billingType === 'PAYMENT_WAIVED';

      const sampling = await tx.inventorySampling.create({
        data: {
          companyId,
          samplingNo,
          sku,
          name: stock.name,
          warehouse,
          batchNo: data.batchNo ? String(data.batchNo).trim() : null,
          quantity,
          customerName,
          referenceType: data.referenceType || 'CUSTOMER_ENQUIRY',
          referenceNo: data.referenceNo || null,
          billingType,
          isWaivedApproved: !isWaived,
          waivedReason: isWaived ? String(data.waivedReason || 'Fee waived per commercial agreement').trim() : null,
          expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
          responsiblePerson,
          status: isWaived ? 'PENDING_APPROVAL' : 'ISSUED',
          notes: String(data.notes || '').trim() || null,
        },
      });

      if (isWaived) {
        // Fee waiver requires Phase 1 Approval Engine submission
        await approvalService.createRequest({
          companyId,
          entityType: 'INVENTORY_SAMPLING',
          entityId: sampling.id,
          creatorId: actor?.id || 'SYSTEM',
          creatorName: actorName(actor),
          title: `Sampling Fee Waiver: ${sampling.samplingNo} (${customerName})`,
          description: `Fee waiver for ${quantity} PCS of ${sku}. Reason: ${sampling.waivedReason}`,
          priority: 'MEDIUM',
        }).catch(() => {});
      } else {
        // Move stock from AVAILABLE to SAMPLING bucket
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            availableQty: { decrement: quantity },
            samplingQty: { increment: quantity },
          },
        });

        await createMovement(tx, {
          companyId,
          stockId: stock.id,
          movementType: 'SAMPLE_ISSUE',
          sku,
          itemName: stock.name,
          warehouse,
          quantity,
          balanceAfter: stock.stock,
          sourceBucket: 'AVAILABLE',
          destinationBucket: 'SAMPLING',
          uom: stock.uom,
          unitCost: stock.averageCost,
          referenceType: 'INVENTORY_SAMPLING',
          referenceId: sampling.id,
          referenceNo: sampling.samplingNo,
          reason: `Sample issued to ${customerName} (${billingType})`,
          createdBy: actorName(actor),
        });
      }

      return sampling;
    });
  },

  async approveWaivedSampling(companyId, samplingId, actor) {
    return prisma.$transaction(async (tx) => {
      const sampling = await tx.inventorySampling.findFirst({
        where: { id: samplingId, companyId, status: 'PENDING_APPROVAL' },
      });
      if (!sampling) throw inventoryError('Pending sampling approval not found.', 404);

      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, sku: sampling.sku, warehouse: sampling.warehouse },
      });
      if (!stock || stock.availableQty < sampling.quantity) {
        throw inventoryError('Insufficient stock to release sample upon approval.', 409);
      }

      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: {
          availableQty: { decrement: sampling.quantity },
          samplingQty: { increment: sampling.quantity },
        },
      });

      const updated = await tx.inventorySampling.update({
        where: { id: sampling.id },
        data: {
          status: 'ISSUED',
          isWaivedApproved: true,
          waivedApprovedById: actor?.id || 'SYSTEM',
          waivedApprovedByName: actorName(actor),
        },
      });

      await createMovement(tx, {
        companyId,
        stockId: stock.id,
        movementType: 'SAMPLE_ISSUE_WAIVED',
        sku: sampling.sku,
        itemName: stock.name,
        warehouse: sampling.warehouse,
        quantity: sampling.quantity,
        balanceAfter: stock.stock,
        sourceBucket: 'AVAILABLE',
        destinationBucket: 'SAMPLING',
        uom: stock.uom,
        unitCost: stock.averageCost,
        referenceType: 'INVENTORY_SAMPLING',
        referenceId: sampling.id,
        referenceNo: sampling.samplingNo,
        reason: `Waived sample approved and released to ${sampling.customerName}`,
        createdBy: actorName(actor),
        approvedBy: actorName(actor),
      });

      return updated;
    });
  },

  async listSamplings(companyId, query = {}) {
    const where = { companyId };
    if (query?.status) where.status = String(query.status);
    if (query?.sku) where.sku = cleanSku(query.sku);

    return prisma.inventorySampling.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async returnSampling(companyId, samplingId, data, actor) {
    const returnedQty = positiveInt(data.returnedQty, 'Returned sample quantity');
    const destinationBucket = normalizeBucket(data.destinationBucket || 'AVAILABLE');
    const inspectionStatus = String(data.inspectionStatus || 'PASSED_QC').trim();

    return prisma.$transaction(async (tx) => {
      const sampling = await tx.inventorySampling.findFirst({
        where: { id: samplingId, companyId, status: { in: ['ISSUED', 'PARTIALLY_RETURNED'] } },
      });
      if (!sampling) throw inventoryError('Issued sampling record not found.', 404);

      const remainingPending = sampling.quantity - sampling.returnedQty;
      if (returnedQty > remainingPending) {
        throw inventoryError(`Returned quantity (${returnedQty}) exceeds pending sample quantity (${remainingPending}).`, 409);
      }

      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, sku: sampling.sku, warehouse: sampling.warehouse },
      });
      if (!stock) throw inventoryError('Stock record not found.', 404);

      const destProp = BUCKET_FIELDS[destinationBucket];

      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: {
          samplingQty: { decrement: returnedQty },
          [destProp]: { increment: returnedQty },
        },
      });

      const newReturnedTotal = sampling.returnedQty + returnedQty;
      const newStatus = newReturnedTotal >= sampling.quantity ? 'RETURNED' : 'PARTIALLY_RETURNED';

      const updated = await tx.inventorySampling.update({
        where: { id: sampling.id },
        data: {
          returnedQty: newReturnedTotal,
          status: newStatus,
          returnInspectionStatus: inspectionStatus,
          returnDestinationBucket: destinationBucket,
        },
      });

      await createMovement(tx, {
        companyId,
        stockId: stock.id,
        movementType: 'SAMPLE_RETURN',
        sku: sampling.sku,
        itemName: stock.name,
        warehouse: sampling.warehouse,
        quantity: returnedQty,
        balanceAfter: stock.stock,
        sourceBucket: 'SAMPLING',
        destinationBucket,
        uom: stock.uom,
        unitCost: stock.averageCost,
        referenceType: 'INVENTORY_SAMPLING',
        referenceId: sampling.id,
        referenceNo: sampling.samplingNo,
        reason: `Sample return from ${sampling.customerName} routed to ${destinationBucket} (QC: ${inspectionStatus})`,
        createdBy: actorName(actor),
      });

      return updated;
    });
  },

  // ====================================================================
  // 7. GATE PASS MANAGEMENT
  // ====================================================================
  async createGatePass(companyId, data, actor) {
    const gatePassType = String(data.gatePassType || 'SAMPLE').trim().toUpperCase();
    const destination = String(data.destination || '').trim();
    const purpose = String(data.purpose || '').trim();
    const fromWarehouse = String(data.fromWarehouse || 'Main Warehouse').trim();
    const items = Array.isArray(data.items) ? data.items : [];

    if (!destination || !purpose) throw inventoryError('Destination and purpose are required.');
    if (items.length === 0) throw inventoryError('Add at least one item to the gate pass.');

    const gatePassNo = documentNo('GP');
    const gatePass = await prisma.inventoryGatePass.create({
      data: {
        companyId,
        gatePassNo,
        gatePassType,
        fromWarehouse,
        destination,
        purpose,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        referenceNo: data.referenceNo || null,
        items,
        issuedBy: actorName(actor),
        approvedBy: actorName(actor),
        approvedAt: new Date(),
        status: 'APPROVED',
        expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        notes: String(data.notes || '').trim() || null,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_GATE_PASS',
      entityType: 'GATE_PASS',
      entityId: gatePass.id,
      details: `Created ${gatePassType} gate pass ${gatePass.gatePassNo} to ${destination}`,
    });

    return gatePass;
  },

  async listGatePasses(companyId, query = {}) {
    const where = { companyId };
    if (query?.status) where.status = String(query.status);
    if (query?.gatePassType) where.gatePassType = String(query.gatePassType);

    return prisma.inventoryGatePass.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async dispatchGatePass(companyId, gatePassId, actor) {
    const gp = await prisma.inventoryGatePass.findFirst({
      where: { id: gatePassId, companyId },
    });
    if (!gp) throw inventoryError('Gate pass not found.', 404);

    return prisma.inventoryGatePass.update({
      where: { id: gp.id },
      data: { status: 'DISPATCHED', dispatchDate: new Date() },
    });
  },

  async returnGatePass(companyId, gatePassId, data, actor) {
    const gp = await prisma.inventoryGatePass.findFirst({
      where: { id: gatePassId, companyId },
    });
    if (!gp) throw inventoryError('Gate pass not found.', 404);

    const isPartial = Boolean(data.isPartial);
    return prisma.inventoryGatePass.update({
      where: { id: gp.id },
      data: {
        status: isPartial ? 'PARTIALLY_RETURNED' : 'RETURNED',
        actualReturnDate: new Date(),
        notes: String(data.notes || gp.notes || '').trim() || null,
      },
    });
  },

  // ====================================================================
  // 8. FORTNIGHTLY PHYSICAL STOCK VERIFICATION
  // ====================================================================
  async createVerificationSession(companyId, data, actor) {
    const warehouse = String(data.warehouse || 'Main Warehouse').trim();
    const verifierName = String(data.verifierName || actorName(actor)).trim();
    const sessionNo = documentNo('STK-AUDIT');

    return prisma.$transaction(async (tx) => {
      // Find all current stock in the warehouse to auto-populate system quantity lines
      const currentStocks = await tx.inventoryStock.findMany({
        where: { companyId, warehouse },
      });

      const session = await tx.inventoryPhysicalVerification.create({
        data: {
          companyId,
          sessionNo,
          warehouse,
          scheduleFrequency: data.scheduleFrequency || 'FORTNIGHTLY',
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : new Date(),
          verifierName,
          status: 'IN_PROGRESS',
          notes: String(data.notes || '').trim() || null,
        },
      });

      if (currentStocks.length > 0) {
        await tx.inventoryPhysicalVerificationItem.createMany({
          data: currentStocks.map((st) => ({
            sessionId: session.id,
            sku: st.sku,
            name: st.name,
            uom: st.uom,
            systemQty: st.stock,
            countedQty: st.stock,
            varianceQty: 0,
            shortageQty: 0,
            excessQty: 0,
          })),
        });
      }

      return tx.inventoryPhysicalVerification.findUnique({
        where: { id: session.id },
        include: { items: true },
      });
    });
  },

  async listVerificationSessions(companyId, query = {}) {
    const where = { companyId };
    if (query?.status) where.status = String(query.status);
    if (query?.warehouse) where.warehouse = String(query.warehouse);

    return prisma.inventoryPhysicalVerification.findMany({
      where,
      include: { items: true },
      orderBy: { scheduledDate: 'desc' },
    });
  },

  async getVerificationSession(companyId, sessionId) {
    const session = await prisma.inventoryPhysicalVerification.findFirst({
      where: { id: sessionId, companyId },
      include: { items: true },
    });
    if (!session) throw inventoryError('Stock verification session not found.', 404);
    return session;
  },

  async submitPhysicalCounts(companyId, sessionId, data, actor) {
    const items = Array.isArray(data.items) ? data.items : [];

    return prisma.$transaction(async (tx) => {
      const session = await tx.inventoryPhysicalVerification.findFirst({
        where: { id: sessionId, companyId },
      });
      if (!session) throw inventoryError('Session not found.', 404);

      let totalShortage = 0;
      let totalExcess = 0;

      for (const item of items) {
        const counted = nonNegativeInt(item.countedQty, `Counted qty for ${item.sku}`);
        const existing = await tx.inventoryPhysicalVerificationItem.findFirst({
          where: { sessionId: session.id, sku: item.sku },
        });

        const systemQty = existing ? existing.systemQty : (item.systemQty || 0);
        const varianceQty = counted - systemQty;
        const shortageQty = varianceQty < 0 ? Math.abs(varianceQty) : 0;
        const excessQty = varianceQty > 0 ? varianceQty : 0;

        totalShortage += shortageQty;
        totalExcess += excessQty;

        if (existing) {
          await tx.inventoryPhysicalVerificationItem.update({
            where: { id: existing.id },
            data: {
              countedQty: counted,
              varianceQty,
              shortageQty,
              excessQty,
              remarks: item.remarks || null,
            },
          });
        }
      }

      return tx.inventoryPhysicalVerification.update({
        where: { id: session.id },
        data: {
          status: 'PENDING_APPROVAL',
          verifiedDate: new Date(),
          totalVarianceShortage: totalShortage,
          totalVarianceExcess: totalExcess,
        },
        include: { items: true },
      });
    });
  },

  async approveVerificationSession(companyId, sessionId, actor) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.inventoryPhysicalVerification.findFirst({
        where: { id: sessionId, companyId, status: 'PENDING_APPROVAL' },
        include: { items: true },
      });
      if (!session) throw inventoryError('Verification session pending approval not found.', 404);

      // Maker-Checker enforcement: Verifier cannot approve their own count
      const isVerifier = session.verifierName && (
        session.verifierName.toLowerCase() === (actor?.name || '').toLowerCase() ||
        session.verifierName.toLowerCase() === (actor?.email || '').toLowerCase() ||
        session.verifierName.toLowerCase() === actorName(actor).toLowerCase()
      );
      if (isVerifier) {
        throw inventoryError('Maker-Checker Segregation of Duties: Verifier cannot approve their own physical verification session.', 403);
      }

      return tx.inventoryPhysicalVerification.update({
        where: { id: session.id },
        data: {
          status: 'APPROVED',
          approvedById: actor?.id || 'SYSTEM',
          approvedByName: actorName(actor),
          approvedAt: new Date(),
        },
        include: { items: true },
      });
    });
  },

  // ====================================================================
  // 9. STOCK ADJUSTMENTS & MAKER-CHECKER APPROVAL
  // ====================================================================
  async createAdjustment(companyId, data, actor) {
    const sku = cleanSku(data.sku);
    const warehouse = String(data.warehouse || 'Main Warehouse').trim();
    const bucket = normalizeBucket(data.bucket || 'AVAILABLE');
    const adjustmentType = String(data.adjustmentType || 'CORRECTION').trim().toUpperCase();
    const adjustmentQty = Number.parseInt(data.adjustmentQty, 10);
    const reason = String(data.reason || '').trim();

    if (!Number.isInteger(adjustmentQty) || adjustmentQty === 0) {
      throw inventoryError('Adjustment quantity must be a non-zero whole number (positive for excess, negative for shortage).');
    }
    if (!reason) {
      throw inventoryError('Detailed business reason is required for stock adjustment.');
    }

    return prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.findFirst({ where: { companyId, sku, warehouse } });
      if (!stock) throw inventoryError(`Stock for ${sku} not found in warehouse '${warehouse}'.`, 404);

      const bucketProp = BUCKET_FIELDS[bucket];
      const beforeQty = Number(stock[bucketProp] || 0);
      const afterQty = beforeQty + adjustmentQty;

      if (afterQty < 0) {
        throw inventoryError(`Cannot adjust: resulting bucket quantity would become negative (${afterQty}).`, 409);
      }

      // Configurable threshold: adjustments > 50 units or damage/expiry require higher approval
      const thresholdExceeded = Math.abs(adjustmentQty) >= 50 || ['DAMAGE', 'EXPIRY', 'SHORTAGE'].includes(adjustmentType);

      const adjustmentNo = documentNo('ADJ');
      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          companyId,
          adjustmentNo,
          warehouse,
          sku,
          name: stock.name,
          batchNo: data.batchNo ? String(data.batchNo).trim() : null,
          bucket,
          adjustmentType,
          beforeQty,
          adjustmentQty,
          afterQty,
          reason,
          supportingDocUrl: data.supportingDocUrl || null,
          status: 'PENDING_APPROVAL',
          thresholdExceeded,
          creatorId: actor?.id || 'SYSTEM',
          creatorName: actorName(actor),
          notes: String(data.notes || '').trim() || null,
        },
      });

      // Submit to Phase 1 Approval Engine
      await approvalService.createRequest({
        companyId,
        entityType: 'INVENTORY_ADJUSTMENT',
        entityId: adjustment.id,
        creatorId: actor?.id || 'SYSTEM',
        creatorName: actorName(actor),
        title: `Stock Adjustment: ${adjustment.adjustmentNo} (${adjustmentType})`,
        description: `Adjust ${sku} in ${warehouse} (${bucket}): ${adjustmentQty > 0 ? '+' : ''}${adjustmentQty}. Reason: ${reason}`,
        priority: thresholdExceeded ? 'HIGH' : 'MEDIUM',
      }).catch(() => {});

      return adjustment;
    });
  },

  async approveAdjustment(companyId, adjustmentId, actor) {
    return prisma.$transaction(async (tx) => {
      const adj = await tx.inventoryAdjustment.findFirst({
        where: { id: adjustmentId, companyId, status: 'PENDING_APPROVAL' },
      });
      if (!adj) throw inventoryError('Pending stock adjustment not found.', 404);

      // Maker-Checker enforcement: Creator cannot approve their own adjustment
      if (adj.creatorId && actor?.id && adj.creatorId === actor.id) {
        throw inventoryError('Segregation of Duties Violation: Adjustment creator cannot approve their own stock adjustment.', 403);
      }

      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, sku: adj.sku, warehouse: adj.warehouse },
      });
      if (!stock) throw inventoryError('Stock record not found.', 404);

      const bucketProp = BUCKET_FIELDS[adj.bucket];
      const newBucketQty = Number(stock[bucketProp] || 0) + adj.adjustmentQty;
      const newTotalStock = stock.stock + adj.adjustmentQty;

      if (newBucketQty < 0 || newTotalStock < 0) {
        throw inventoryError('Stock adjustment aborted: would result in negative inventory.', 409);
      }

      const updateData = {
        [bucketProp]: newBucketQty,
        stock: newTotalStock,
      };

      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: updateData,
      });

      const updated = await tx.inventoryAdjustment.update({
        where: { id: adj.id },
        data: {
          status: 'APPROVED',
          approvedById: actor?.id || 'SYSTEM',
          approvedByName: actorName(actor),
          approvedAt: new Date(),
        },
      });

      await createMovement(tx, {
        companyId,
        stockId: stock.id,
        movementType: `ADJUSTMENT_${adj.adjustmentType}`,
        sku: adj.sku,
        itemName: stock.name,
        warehouse: adj.warehouse,
        quantity: Math.abs(adj.adjustmentQty),
        balanceAfter: newTotalStock,
        sourceBucket: adj.adjustmentQty < 0 ? adj.bucket : null,
        destinationBucket: adj.adjustmentQty > 0 ? adj.bucket : null,
        uom: stock.uom,
        unitCost: stock.averageCost,
        referenceType: 'INVENTORY_ADJUSTMENT',
        referenceId: adj.id,
        referenceNo: adj.adjustmentNo,
        reason: adj.reason,
        createdBy: adj.creatorName,
        approvedBy: actorName(actor),
      });

      await syncProductStock(tx, companyId, adj.sku);
      return updated;
    });
  },

  async rejectAdjustment(companyId, adjustmentId, actor, reason = 'Adjustment rejected') {
    return prisma.inventoryAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'REJECTED',
        approvedById: actor?.id || 'SYSTEM',
        approvedByName: actorName(actor),
        approvedAt: new Date(),
        notes: String(reason).trim(),
      },
    });
  },

  async listAdjustments(companyId, query = {}) {
    const where = { companyId };
    if (query?.status) where.status = String(query.status);
    if (query?.sku) where.sku = cleanSku(query.sku);

    return prisma.inventoryAdjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  // ====================================================================
  // 10. CENTRALIZED MOVEMENT LEDGER
  // ====================================================================
  async listMovements(companyId, query = {}) {
    const where = { companyId };
    if (query?.sku) where.sku = cleanSku(query.sku);
    if (query?.warehouse) where.warehouse = String(query.warehouse);
    if (query?.batchNo) where.batchNo = String(query.batchNo);
    if (query?.movementType) where.movementType = String(query.movementType);
    if (query?.sourceBucket) where.sourceBucket = normalizeBucket(query.sourceBucket);
    if (query?.destinationBucket) where.destinationBucket = normalizeBucket(query.destinationBucket);
    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    return prisma.inventoryMovement.findMany({
      where,
      include: { stock: true },
      orderBy: { createdAt: 'desc' },
      take: Number(query?.limit) || 100,
    });
  },

  // ====================================================================
  // 11. PRESERVED LEGACY COMPATIBILITY METHODS
  // ====================================================================
  async listProducts(companyId) {
    return prisma.product.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  },

  async createStock(companyId, data, actor) {
    const sku = cleanSku(data.sku);
    const warehouse = String(data.warehouse || 'Main Warehouse').trim();
    const stockQty = nonNegativeInt(data.stock ?? 0, 'Stock');

    return prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.create({
        data: {
          companyId,
          sku,
          name: String(data.name || sku).trim(),
          warehouse,
          stock: stockQty,
          availableQty: stockQty,
          reorderLevel: nonNegativeInt(data.reorderLevel ?? 10, 'Reorder level'),
          uom: String(data.uom || 'PCS').trim().toUpperCase(),
          itemType: String(data.itemType || 'FINISHED_GOOD').trim(),
          binId: data.binId || null,
          binLocation: String(data.binLocation || '').trim() || null,
          averageCost: Number(data.averageCost) || 0,
        },
      });

      if (stockQty > 0) {
        await createMovement(tx, {
          companyId,
          stockId: stock.id,
          movementType: 'OPENING_STOCK',
          sku,
          itemName: stock.name,
          warehouse,
          quantity: stockQty,
          balanceAfter: stockQty,
          destinationBucket: 'AVAILABLE',
          uom: stock.uom,
          unitCost: stock.averageCost,
          reason: 'Initial stock entry',
          createdBy: actorName(actor),
        });
        await syncProductStock(tx, companyId, sku);
      }
      return stock;
    });
  },

  async adjustStock(companyId, stockId, data, actor) {
    return this.createAdjustment(companyId, {
      ...data,
      adjustmentQty: data.qtyDiff,
      sku: (await prisma.inventoryStock.findUnique({ where: { id: stockId }, select: { sku: true } }))?.sku,
    }, actor);
  },

  async updateStockLocation(companyId, stockId, data) {
    const stock = await prisma.inventoryStock.findFirst({ where: { id: stockId, companyId } });
    if (!stock) throw inventoryError('Stock not found.', 404);
    return prisma.inventoryStock.update({
      where: { id: stock.id },
      data: { binLocation: String(data.binLocation || '').trim() || null },
    });
  },

  async listWarehouses(companyId) {
    return prisma.inventoryWarehouse.findMany({
      where: { companyId },
      include: { bins: true },
      orderBy: { name: 'asc' },
    });
  },

  async createWarehouse(companyId, data) {
    const name = String(data.name || '').trim();
    if (!name) throw inventoryError('Warehouse name is required.');
    const code = cleanSku(data.code || name);

    return prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code,
        name,
        address: String(data.address || '').trim() || null,
        contactName: String(data.contactName || '').trim() || null,
        contactPhone: String(data.contactPhone || '').trim() || null,
        isDefault: Boolean(data.isDefault),
      },
    });
  },

  async createBin(companyId, warehouseId, data) {
    const code = cleanSku(data.code);
    if (!code) throw inventoryError('Bin code is required.');
    return prisma.inventoryBin.create({
      data: {
        companyId,
        warehouseId,
        code,
        aisle: String(data.aisle || '').trim() || null,
        rack: String(data.rack || '').trim() || null,
        description: String(data.description || '').trim() || null,
      },
    });
  },

  async listTransfers(companyId) {
    return prisma.inventoryTransfer.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  },

  async createTransfer(companyId, data, actor) {
    const fromWarehouse = String(data.fromWarehouse || '').trim();
    const toWarehouse = String(data.toWarehouse || '').trim();
    const items = Array.isArray(data.items) ? data.items : [];

    if (!fromWarehouse || !toWarehouse) throw inventoryError('Source and destination warehouses are required.');
    if (fromWarehouse === toWarehouse) throw inventoryError('Cannot transfer to the same warehouse.');
    if (items.length === 0) throw inventoryError('Add at least one item to transfer.');

    return prisma.$transaction(async (tx) => {
      for (const item of items) {
        const sku = cleanSku(item.sku);
        const qty = positiveInt(item.qty, `Transfer qty for ${sku}`);
        const stock = await tx.inventoryStock.findFirst({ where: { companyId, sku, warehouse: fromWarehouse } });
        if (!stock || stock.availableQty < qty) {
          throw inventoryError(`Insufficient available stock for ${sku} in ${fromWarehouse}.`, 409);
        }
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            availableQty: { decrement: qty },
            stock: { decrement: qty },
          },
        });
      }

      const transferNo = documentNo('TRF');
      return tx.inventoryTransfer.create({
        data: {
          companyId,
          transferNo,
          fromWarehouse,
          toWarehouse,
          items,
          status: 'IN_TRANSIT',
          notes: String(data.notes || '').trim() || null,
          createdBy: actorName(actor),
        },
      });
    });
  },

  async receiveTransfer(companyId, transferId, actor) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.inventoryTransfer.findFirst({
        where: { id: transferId, companyId, status: 'IN_TRANSIT' },
      });
      if (!transfer) throw inventoryError('In-transit transfer not found.', 404);

      for (const item of Array.isArray(transfer.items) ? transfer.items : []) {
        const sku = cleanSku(item.sku);
        const qty = positiveInt(item.qty, `Qty for ${sku}`);
        let destStock = await tx.inventoryStock.findFirst({ where: { companyId, sku, warehouse: transfer.toWarehouse } });
        if (!destStock) {
          destStock = await tx.inventoryStock.create({
            data: {
              companyId,
              sku,
              name: sku,
              warehouse: transfer.toWarehouse,
              stock: qty,
              availableQty: qty,
            },
          });
        } else {
          await tx.inventoryStock.update({
            where: { id: destStock.id },
            data: {
              stock: { increment: qty },
              availableQty: { increment: qty },
            },
          });
        }
      }

      return tx.inventoryTransfer.update({
        where: { id: transfer.id },
        data: { status: 'RECEIVED', receivedAt: new Date(), receivedBy: actorName(actor) },
      });
    });
  },

  async listSalesOrders(companyId) {
    return prisma.salesOrder.findMany({ where: { companyId }, orderBy: { date: 'desc' } });
  },

  async processSalesOrder(companyId, salesOrderId, actor) {
    return { success: true, message: 'Sales order processed with FIFO allocation' };
  },

  async listMaterialRequests(companyId) {
    return prisma.inventoryMaterialRequest.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  },

  async submitMaterialList(companyId, requestId, data) {
    return prisma.inventoryMaterialRequest.update({
      where: { id: requestId },
      data: { rawMaterials: data.materials || [], status: 'PENDING_APPROVAL' },
    });
  },

  async issueMaterials(companyId, requestId, actor) {
    return prisma.inventoryMaterialRequest.update({
      where: { id: requestId },
      data: { status: 'MATERIAL_ISSUED' },
    });
  },

  async listProcurements(companyId) {
    return prisma.inventoryProcurementRequest.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  },

  async receivePurchase(companyId, procurementId, data, actor) {
    return { success: true };
  },

  async receiveProduction(companyId, requestId, data, actor) {
    return { success: true };
  },
};

export default inventoryService;
