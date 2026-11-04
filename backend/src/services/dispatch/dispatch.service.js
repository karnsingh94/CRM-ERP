import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function dispatchError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function documentNo(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const timeSuffix = Date.now().toString().slice(-4);
  return `${prefix}-${year}${month}-${timeSuffix}${rand}`;
}

export const dispatchService = {
  // =========================================================================
  // 1. DASHBOARD & ELIGIBLE SALES ORDERS
  // =========================================================================
  async getDashboard(companyId) {
    const [
      pendingDispatchOrders,
      readyDispatchOrders,
      inTransitDispatchOrders,
      deliveredDispatchOrders,
      failedDispatchOrders,
      dispatchesAgg,
    ] = await Promise.all([
      prisma.salesOrder.count({
        where: {
          companyId,
          status: { in: ['APPROVED', 'CONFIRMED', 'RELEASED'] },
        },
      }),
      prisma.dispatchOrder.count({
        where: {
          companyId,
          status: { in: ['DRAFT', 'PACKING', 'READY_FOR_DISPATCH'] },
        },
      }),
      prisma.dispatchOrder.count({
        where: {
          companyId,
          status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
        },
      }),
      prisma.dispatchOrder.count({
        where: {
          companyId,
          status: 'DELIVERED',
        },
      }),
      prisma.dispatchOrder.count({
        where: {
          companyId,
          status: { in: ['FAILED', 'CANCELLED'] },
        },
      }),
      prisma.dispatchOrder.aggregate({
        where: {
          companyId,
          status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'] },
        },
        _sum: {
          totalDispatchedAmount: true,
          totalDispatchedQty: true,
        },
      }),
    ]);

    return {
      pendingSalesOrders: pendingDispatchOrders,
      readyToDispatch: readyDispatchOrders,
      inTransit: inTransitDispatchOrders,
      delivered: deliveredDispatchOrders,
      failed: failedDispatchOrders,
      totalDispatchedAmount: Number(dispatchesAgg._sum.totalDispatchedAmount || 0),
      totalDispatchedQty: Number(dispatchesAgg._sum.totalDispatchedQty || 0),
    };
  },

  async listEligibleSalesOrders(companyId, filters = {}) {
    const { customerId, search } = filters;
    const where = {
      companyId,
      status: { in: ['APPROVED', 'CONFIRMED', 'RELEASED', 'PARTIALLY_DISPATCHED'] },
    };

    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
        { customer: { contains: search } },
      ];
    }

    const salesOrders = await prisma.salesOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        dispatchOrders: {
          where: { status: { not: 'CANCELLED' } },
          include: { items: true },
        },
      },
    });

    const eligibleOrders = [];

    for (const so of salesOrders) {
      let rawItems = [];
      if (Array.isArray(so.items)) {
        rawItems = so.items;
      } else if (typeof so.items === 'string') {
        try {
          rawItems = JSON.parse(so.items);
        } catch {
          rawItems = [];
        }
      }

      // Calculate already dispatched quantities across active dispatch orders
      const dispatchedMap = new Map();
      for (const dsp of so.dispatchOrders) {
        for (const item of dsp.items) {
          const sku = String(item.sku).trim();
          const curr = dispatchedMap.get(sku) || 0;
          dispatchedMap.set(sku, curr + Number(item.dispatchedQty));
        }
      }

      const itemFulfillments = [];
      let totalOrderedQty = 0;
      let totalPendingQty = 0;

      for (const item of rawItems) {
        const sku = String(item.sku || item.itemCode || item.code || '').trim();
        const orderedQty = Number(item.quantity || item.qty || 1);
        const dispatchedQty = dispatchedMap.get(sku) || 0;
        const pendingQty = Math.max(0, orderedQty - dispatchedQty);

        totalOrderedQty += orderedQty;
        totalPendingQty += pendingQty;

        itemFulfillments.push({
          sku,
          productName: item.name || item.description || sku,
          uom: item.uom || 'PCS',
          unitPrice: Number(item.price || item.unitPrice || 0),
          orderedQty,
          dispatchedQty,
          pendingQty,
          taxRate: Number(item.taxRate || item.gstRate || 0),
          hsnCode: item.hsnCode || null,
        });
      }

      // If pending fulfillment remains, include in eligible list
      if (totalPendingQty > 0 || rawItems.length === 0) {
        eligibleOrders.push({
          id: so.id,
          orderNo: so.orderNo,
          customerId: so.customerId,
          customerName: so.customer,
          date: so.date,
          status: so.status,
          totalOrderedQty,
          totalPendingQty,
          fulfillmentPercentage: totalOrderedQty > 0
            ? Math.round(((totalOrderedQty - totalPendingQty) / totalOrderedQty) * 100)
            : 0,
          items: itemFulfillments,
        });
      }
    }

    return eligibleOrders;
  },

  // =========================================================================
  // 2. DISPATCH ORDER CREATION & LIFECYCLE
  // =========================================================================
  async createDispatchOrder(companyId, data, actor = {}) {
    const {
      salesOrderId,
      customerId,
      customerName,
      customerGstin,
      shippingAddress,
      billingAddress,
      warehouseId,
      warehouseName,
      carrierName,
      trackingNo,
      vehicleNo,
      driverName,
      driverPhone,
      ewayBillNo,
      ewayBillDate,
      ewayBillValidTill,
      invoiceNo,
      invoiceDate,
      notes,
      items = [],
      autoAllocateFIFO = true,
    } = data;

    if (!items || items.length === 0) {
      throw dispatchError('At least one item is required to create a dispatch order.');
    }

    return prisma.$transaction(async (tx) => {
      let salesOrder = null;
      let finalCustomerId = customerId;
      let finalCustomerName = customerName;

      if (salesOrderId) {
        salesOrder = await tx.salesOrder.findFirst({
          where: { id: salesOrderId, companyId },
          include: {
            dispatchOrders: {
              where: { status: { not: 'CANCELLED' } },
              include: { items: true },
            },
          },
        });

        if (!salesOrder) {
          throw dispatchError(`Sales Order not found for id ${salesOrderId}.`, 404);
        }

        if (['CANCELLED', 'REJECTED', 'DRAFT'].includes(salesOrder.status)) {
          throw dispatchError(`Cannot dispatch against Sales Order with status ${salesOrder.status}. Must be approved.`);
        }

        finalCustomerId = finalCustomerId || salesOrder.customerId;
        finalCustomerName = finalCustomerName || salesOrder.customer;
      }

      if (!finalCustomerName) {
        throw dispatchError('Customer name is required.');
      }

      // Check remaining quantities on Sales Order
      let isPartial = false;
      let totalDispatchedQty = new Decimal(0);
      let totalDispatchedAmount = new Decimal(0);

      const validatedItems = [];

      for (const item of items) {
        const sku = String(item.sku).trim();
        const requestedQty = new Decimal(item.dispatchedQty || item.quantity || 0);

        if (requestedQty.lte(0)) {
          throw dispatchError(`Dispatched quantity for SKU ${sku} must be greater than zero.`);
        }

        let orderedQty = new Decimal(item.orderedQty || requestedQty);
        let unitPrice = new Decimal(item.unitPrice || 0);
        let taxRate = new Decimal(item.taxRate || 0);
        let hsnCode = item.hsnCode || null;
        let productName = item.productName || item.name || sku;

        if (salesOrder) {
          let rawItems = [];
          if (Array.isArray(salesOrder.items)) {
            rawItems = salesOrder.items;
          } else if (typeof salesOrder.items === 'string') {
            try { rawItems = JSON.parse(salesOrder.items); } catch { rawItems = []; }
          }

          const soItem = rawItems.find((i) => String(i.sku || i.itemCode || i.code).trim() === sku);
          if (soItem) {
            orderedQty = new Decimal(soItem.quantity || soItem.qty || requestedQty);
            unitPrice = new Decimal(soItem.price || soItem.unitPrice || unitPrice);
            taxRate = new Decimal(soItem.taxRate || soItem.gstRate || taxRate);
            hsnCode = hsnCode || soItem.hsnCode || null;
            productName = soItem.name || soItem.description || productName;

            // Calculate already dispatched
            let alreadyDispatched = new Decimal(0);
            for (const dsp of salesOrder.dispatchOrders) {
              for (const prevItem of dsp.items) {
                if (String(prevItem.sku).trim() === sku) {
                  alreadyDispatched = alreadyDispatched.add(prevItem.dispatchedQty);
                }
              }
            }

            const remainingAllowed = orderedQty.sub(alreadyDispatched);
            if (requestedQty.gt(remainingAllowed)) {
              throw dispatchError(
                `Requested quantity (${requestedQty}) for ${sku} exceeds remaining pending quantity (${remainingAllowed}) on Sales Order ${salesOrder.orderNo}.`
              );
            }

            if (alreadyDispatched.add(requestedQty).lt(orderedQty)) {
              isPartial = true;
            }
          }
        }

        // Calculate line financial amounts
        const lineTotal = requestedQty.mul(unitPrice);
        const lineTax = lineTotal.mul(taxRate).div(100);
        const lineGross = lineTotal.add(lineTax);

        totalDispatchedQty = totalDispatchedQty.add(requestedQty);
        totalDispatchedAmount = totalDispatchedAmount.add(lineGross);

        // Find product ID if exists
        const product = await tx.product.findFirst({
          where: { companyId, sku },
        });

        validatedItems.push({
          companyId,
          productId: product ? product.id : null,
          sku,
          productName,
          uom: item.uom || 'PCS',
          orderedQty,
          dispatchedQty: requestedQty,
          unitPrice,
          totalAmount: lineTotal,
          taxRate,
          taxAmount: lineTax,
          grossAmount: lineGross,
          hsnCode,
          notes: item.notes || null,
        });
      }

      const dispatchNo = documentNo('DSP');
      const fulfillmentType = isPartial ? 'PARTIAL' : 'FULL';

      const dispatchOrder = await tx.dispatchOrder.create({
        data: {
          companyId,
          dispatchNo,
          salesOrderId: salesOrder ? salesOrder.id : null,
          salesOrderNo: salesOrder ? salesOrder.orderNo : null,
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          customerGstin: customerGstin || null,
          shippingAddress: shippingAddress || null,
          billingAddress: billingAddress || null,
          status: 'DRAFT',
          fulfillmentType,
          warehouseId: warehouseId || null,
          warehouseName: warehouseName || null,
          carrierName: carrierName || null,
          trackingNo: trackingNo || null,
          vehicleNo: vehicleNo || null,
          driverName: driverName || null,
          driverPhone: driverPhone || null,
          ewayBillNo: ewayBillNo || null,
          ewayBillDate: ewayBillDate ? new Date(ewayBillDate) : null,
          ewayBillValidTill: ewayBillValidTill ? new Date(ewayBillValidTill) : null,
          invoiceNo: invoiceNo || null,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          totalDispatchedQty,
          totalDispatchedAmount,
          notes: notes || null,
          items: {
            create: validatedItems,
          },
        },
        include: {
          items: true,
        },
      });

      // Multi-Batch FIFO Allocation
      if (autoAllocateFIFO) {
        for (const lineItem of dispatchOrder.items) {
          const qtyNeeded = Number(lineItem.dispatchedQty);
          const now = new Date();

          const batchWhere = {
            companyId,
            sku: lineItem.sku,
            status: 'ACTIVE',
            availableQty: { gt: 0 },
          };
          if (warehouseName) batchWhere.warehouse = warehouseName;

          const eligibleBatches = await tx.inventoryBatch.findMany({
            where: batchWhere,
            orderBy: [
              { manufacturingDate: 'asc' },
              { receivedDate: 'asc' },
              { createdAt: 'asc' },
            ],
          });

          const nonExpiredBatches = eligibleBatches.filter((b) => !b.expiryDate || new Date(b.expiryDate) > now);
          const totalAvailable = nonExpiredBatches.reduce((sum, b) => sum + b.availableQty, 0);

          if (totalAvailable >= qtyNeeded) {
            let remaining = qtyNeeded;
            for (const b of nonExpiredBatches) {
              if (remaining <= 0) break;
              const take = Math.min(b.availableQty, remaining);

              await tx.dispatchItemBatchAllocation.create({
                data: {
                  companyId,
                  dispatchOrderItemId: lineItem.id,
                  inventoryBatchId: b.id,
                  batchNo: b.batchNo,
                  allocatedQty: new Decimal(take),
                  unitCost: b.unitCost,
                },
              });

              remaining -= take;
            }
          }
        }
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Logistics Coordinator',
        action: 'DISPATCH_ORDER_CREATE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_orders',
        details: `Created Dispatch Order ${dispatchNo} for customer ${finalCustomerName} with ${validatedItems.length} items. Total Amount: ₹${totalDispatchedAmount.toFixed(2)}.`,
      });

      return dispatchOrder;
    });
  },

  async listDispatchOrders(companyId, filters = {}) {
    const { status, salesOrderId, customerId, search, fromDate, toDate } = filters;
    const where = { companyId };

    if (status) where.status = status;
    if (salesOrderId) where.salesOrderId = salesOrderId;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { dispatchNo: { contains: search } },
        { salesOrderNo: { contains: search } },
        { customerName: { contains: search } },
        { trackingNo: { contains: search } },
        { invoiceNo: { contains: search } },
      ];
    }
    if (fromDate || toDate) {
      where.dispatchDate = {};
      if (fromDate) where.dispatchDate.gte = new Date(fromDate);
      if (toDate) where.dispatchDate.lte = new Date(toDate);
    }

    return prisma.dispatchOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            batchAllocations: true,
          },
        },
        packages: true,
        trackingEvents: {
          orderBy: { eventDate: 'desc' },
          take: 1,
        },
      },
    });
  },

  async getDispatchOrderById(companyId, dispatchOrderId) {
    const order = await prisma.dispatchOrder.findFirst({
      where: { id: dispatchOrderId, companyId },
      include: {
        items: {
          include: {
            batchAllocations: {
              include: {
                inventoryBatch: true,
              },
            },
          },
        },
        packages: {
          orderBy: { packageNumber: 'asc' },
        },
        trackingEvents: {
          orderBy: { eventDate: 'asc' },
        },
        customerReturns: true,
        salesOrder: true,
        customer: true,
        warehouse: true,
      },
    });

    if (!order) {
      throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
    }

    return order;
  },

  async updateDispatchOrder(companyId, dispatchOrderId, data, actor = {}) {
    const order = await prisma.dispatchOrder.findFirst({
      where: { id: dispatchOrderId, companyId },
    });

    if (!order) {
      throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
    }

    if (['DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw dispatchError(`Cannot modify Dispatch Order ${order.dispatchNo} in ${order.status} status.`);
    }

    const {
      carrierName,
      trackingNo,
      vehicleNo,
      driverName,
      driverPhone,
      ewayBillNo,
      ewayBillDate,
      ewayBillValidTill,
      invoiceNo,
      invoiceDate,
      shippingAddress,
      billingAddress,
      notes,
      warehouseId,
      warehouseName,
    } = data;

    const updated = await prisma.dispatchOrder.update({
      where: { id: order.id },
      data: {
        carrierName: carrierName !== undefined ? carrierName : order.carrierName,
        trackingNo: trackingNo !== undefined ? trackingNo : order.trackingNo,
        vehicleNo: vehicleNo !== undefined ? vehicleNo : order.vehicleNo,
        driverName: driverName !== undefined ? driverName : order.driverName,
        driverPhone: driverPhone !== undefined ? driverPhone : order.driverPhone,
        ewayBillNo: ewayBillNo !== undefined ? ewayBillNo : order.ewayBillNo,
        ewayBillDate: ewayBillDate ? new Date(ewayBillDate) : order.ewayBillDate,
        ewayBillValidTill: ewayBillValidTill ? new Date(ewayBillValidTill) : order.ewayBillValidTill,
        invoiceNo: invoiceNo !== undefined ? invoiceNo : order.invoiceNo,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : order.invoiceDate,
        shippingAddress: shippingAddress !== undefined ? shippingAddress : order.shippingAddress,
        billingAddress: billingAddress !== undefined ? billingAddress : order.billingAddress,
        notes: notes !== undefined ? notes : order.notes,
        warehouseId: warehouseId !== undefined ? warehouseId : order.warehouseId,
        warehouseName: warehouseName !== undefined ? warehouseName : order.warehouseName,
      },
      include: {
        items: true,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Logistics Coordinator',
      action: 'DISPATCH_ORDER_UPDATE',
      serviceCode: 'dispatch_returns',
      moduleCode: 'dispatch_orders',
      details: `Updated details for Dispatch Order ${order.dispatchNo}.`,
    });

    return updated;
  },

  // =========================================================================
  // 3. MULTI-BATCH FIFO ALLOCATION
  // =========================================================================
  async allocateFIFO(companyId, dispatchOrderId, { itemId, manualAllocations = null }, actor = {}) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
        include: { items: { include: { batchAllocations: true } } },
      });

      if (!order) {
        throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
      }

      if (['DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
        throw dispatchError(`Cannot alter allocations on Dispatch Order ${order.dispatchNo} in status ${order.status}.`);
      }

      const itemsToAllocate = itemId
        ? order.items.filter((i) => i.id === itemId)
        : order.items;

      const allocationResults = [];

      for (const lineItem of itemsToAllocate) {
        const requiredQty = Number(lineItem.dispatchedQty);

        // Delete existing allocations for this item to ensure clean replacement
        await tx.dispatchItemBatchAllocation.deleteMany({
          where: { dispatchOrderItemId: lineItem.id },
        });

        if (manualAllocations && Array.isArray(manualAllocations)) {
          let sumAllocated = 0;
          for (const alloc of manualAllocations) {
            const batch = await tx.inventoryBatch.findFirst({
              where: { id: alloc.inventoryBatchId, companyId, sku: lineItem.sku },
            });
            if (!batch) {
              throw dispatchError(`Batch ${alloc.batchNo} not found or mismatch for SKU ${lineItem.sku}.`);
            }
            if (batch.availableQty < alloc.allocatedQty) {
              throw dispatchError(`Batch ${batch.batchNo} has insufficient available stock (${batch.availableQty} < ${alloc.allocatedQty}).`);
            }

            await tx.dispatchItemBatchAllocation.create({
              data: {
                companyId,
                dispatchOrderItemId: lineItem.id,
                inventoryBatchId: batch.id,
                batchNo: batch.batchNo,
                allocatedQty: new Decimal(alloc.allocatedQty),
                unitCost: batch.unitCost,
              },
            });
            sumAllocated += Number(alloc.allocatedQty);
          }

          if (sumAllocated !== requiredQty) {
            throw dispatchError(`Manual batch allocations sum (${sumAllocated}) does not match item dispatched quantity (${requiredQty}).`);
          }

          allocationResults.push({ itemId: lineItem.id, sku: lineItem.sku, totalAllocated: sumAllocated });
        } else {
          // FIFO automated allocation
          const now = new Date();
          const batchWhere = {
            companyId,
            sku: lineItem.sku,
            status: 'ACTIVE',
            availableQty: { gt: 0 },
          };
          if (order.warehouseName) batchWhere.warehouse = order.warehouseName;

          const eligibleBatches = await tx.inventoryBatch.findMany({
            where: batchWhere,
            orderBy: [
              { manufacturingDate: 'asc' },
              { receivedDate: 'asc' },
              { createdAt: 'asc' },
            ],
          });

          const nonExpiredBatches = eligibleBatches.filter((b) => !b.expiryDate || new Date(b.expiryDate) > now);
          const totalAvailable = nonExpiredBatches.reduce((sum, b) => sum + b.availableQty, 0);

          if (totalAvailable < requiredQty) {
            throw dispatchError(
              `Insufficient FIFO available stock for ${lineItem.sku}. Required: ${requiredQty}, Available: ${totalAvailable}.`,
              409
            );
          }

          let remaining = requiredQty;
          const lineAllocations = [];

          for (const b of nonExpiredBatches) {
            if (remaining <= 0) break;
            const take = Math.min(b.availableQty, remaining);

            const record = await tx.dispatchItemBatchAllocation.create({
              data: {
                companyId,
                dispatchOrderItemId: lineItem.id,
                inventoryBatchId: b.id,
                batchNo: b.batchNo,
                allocatedQty: new Decimal(take),
                unitCost: b.unitCost,
              },
            });

            lineAllocations.push({
              allocationId: record.id,
              batchNo: b.batchNo,
              allocatedQty: take,
              unitCost: Number(b.unitCost),
            });

            remaining -= take;
          }

          allocationResults.push({
            itemId: lineItem.id,
            sku: lineItem.sku,
            requiredQty,
            allocations: lineAllocations,
          });
        }
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Warehouse Operator',
        action: 'DISPATCH_FIFO_ALLOCATION',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_orders',
        details: `Executed FIFO batch allocation for Dispatch Order ${order.dispatchNo}.`,
      });

      return {
        dispatchOrderId: order.id,
        dispatchNo: order.dispatchNo,
        allocations: allocationResults,
      };
    });
  },

  // =========================================================================
  // 4. PACKING LIST & DELIVERY CHALLAN
  // =========================================================================
  async createPackage(companyId, dispatchOrderId, packageData, actor = {}) {
    const { boxType, lengthCm, widthCm, heightCm, weightGrossKg, weightNetKg, barcode, itemDetails, notes } = packageData;

    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
        include: { packages: true },
      });

      if (!order) {
        throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
      }

      if (['DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
        throw dispatchError(`Cannot pack packages for Dispatch Order ${order.dispatchNo} in status ${order.status}.`);
      }

      const nextPackageNumber = order.packages.length + 1;
      const packageCode = `PKG-${order.dispatchNo}-${String(nextPackageNumber).padStart(2, '0')}`;

      const newPkg = await tx.dispatchPackage.create({
        data: {
          companyId,
          dispatchOrderId: order.id,
          packageNumber: nextPackageNumber,
          packageCode,
          boxType: boxType || 'CARTON',
          lengthCm: lengthCm ? new Decimal(lengthCm) : null,
          widthCm: widthCm ? new Decimal(widthCm) : null,
          heightCm: heightCm ? new Decimal(heightCm) : null,
          weightGrossKg: new Decimal(weightGrossKg || 0),
          weightNetKg: new Decimal(weightNetKg || 0),
          barcode: barcode || packageCode,
          itemDetails: itemDetails || null,
          notes: notes || null,
        },
      });

      // Recalculate package totals on DispatchOrder
      const allPackages = await tx.dispatchPackage.findMany({
        where: { dispatchOrderId: order.id },
      });

      const totalPackages = allPackages.length;
      const totalGrossWeightKg = allPackages.reduce((acc, p) => acc.add(p.weightGrossKg), new Decimal(0));
      const totalNetWeightKg = allPackages.reduce((acc, p) => acc.add(p.weightNetKg), new Decimal(0));

      await tx.dispatchOrder.update({
        where: { id: order.id },
        data: {
          totalPackages,
          totalGrossWeightKg,
          totalNetWeightKg,
          status: order.status === 'DRAFT' ? 'PACKING' : order.status,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Packing Supervisor',
        action: 'DISPATCH_PACKAGE_CREATE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_orders',
        details: `Created package ${packageCode} for Dispatch Order ${order.dispatchNo}. Gross Weight: ${weightGrossKg} KG.`,
      });

      return newPkg;
    });
  },

  async getPackingList(companyId, dispatchOrderId) {
    const order = await prisma.dispatchOrder.findFirst({
      where: { id: dispatchOrderId, companyId },
      include: {
        packages: { orderBy: { packageNumber: 'asc' } },
        items: true,
        salesOrder: true,
        customer: true,
      },
    });

    if (!order) {
      throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
    }

    return {
      documentType: 'PACKING_LIST',
      dispatchNo: order.dispatchNo,
      dispatchDate: order.dispatchDate,
      salesOrderNo: order.salesOrderNo,
      customerName: order.customerName,
      customerGstin: order.customerGstin,
      shippingAddress: order.shippingAddress,
      totalPackages: order.totalPackages,
      totalGrossWeightKg: Number(order.totalGrossWeightKg),
      totalNetWeightKg: Number(order.totalNetWeightKg),
      carrierName: order.carrierName,
      vehicleNo: order.vehicleNo,
      packages: order.packages.map((pkg) => ({
        packageNumber: pkg.packageNumber,
        packageCode: pkg.packageCode,
        boxType: pkg.boxType,
        dimensions: `${pkg.lengthCm || 0} x ${pkg.widthCm || 0} x ${pkg.heightCm || 0} cm`,
        weightGrossKg: Number(pkg.weightGrossKg),
        weightNetKg: Number(pkg.weightNetKg),
        barcode: pkg.barcode,
        itemDetails: pkg.itemDetails,
      })),
      items: order.items.map((i) => ({
        sku: i.sku,
        productName: i.productName,
        uom: i.uom,
        dispatchedQty: Number(i.dispatchedQty),
        hsnCode: i.hsnCode,
      })),
    };
  },

  async getDeliveryChallan(companyId, dispatchOrderId) {
    const order = await prisma.dispatchOrder.findFirst({
      where: { id: dispatchOrderId, companyId },
      include: {
        items: {
          include: {
            batchAllocations: true,
          },
        },
        customer: true,
        salesOrder: true,
      },
    });

    if (!order) {
      throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
    }

    return {
      documentType: 'DELIVERY_CHALLAN',
      challanNo: order.dispatchNo,
      challanDate: order.dispatchDate,
      salesOrderNo: order.salesOrderNo,
      customerName: order.customerName,
      customerGstin: order.customerGstin,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      transporter: order.carrierName || 'Self Transport',
      vehicleNo: order.vehicleNo || 'N/A',
      driverName: order.driverName || 'N/A',
      driverPhone: order.driverPhone || 'N/A',
      ewayBillNo: order.ewayBillNo || 'N/A',
      ewayBillDate: order.ewayBillDate,
      ewayBillValidTill: order.ewayBillValidTill,
      invoiceNo: order.invoiceNo,
      invoiceDate: order.invoiceDate,
      gatePassNo: order.gatePassNo,
      totalPackages: order.totalPackages,
      totalDispatchedQty: Number(order.totalDispatchedQty),
      totalDispatchedAmount: Number(order.totalDispatchedAmount),
      items: order.items.map((i) => ({
        sku: i.sku,
        productName: i.productName,
        hsnCode: i.hsnCode || 'N/A',
        uom: i.uom,
        dispatchedQty: Number(i.dispatchedQty),
        unitPrice: Number(i.unitPrice),
        taxableAmount: Number(i.totalAmount),
        taxRate: Number(i.taxRate),
        taxAmount: Number(i.taxAmount),
        grossAmount: Number(i.grossAmount),
        batches: i.batchAllocations.map((b) => `${b.batchNo} (${b.allocatedQty})`).join(', ') || 'N/A',
      })),
      terms: 'Subject to Shree Nath Exports terms of trade. Goods received in good condition.',
    };
  },

  // =========================================================================
  // 5. GATE PASS INTEGRATION
  // =========================================================================
  async generateGatePass(companyId, dispatchOrderId, passData = {}, actor = {}) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
      });

      if (!order) {
        throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
      }

      if (order.gatePassId) {
        return {
          message: 'Gate pass already generated for this dispatch order.',
          gatePassId: order.gatePassId,
          gatePassNo: order.gatePassNo,
        };
      }

      const passNo = documentNo('GP-OUT');

      const gatePass = await tx.inventoryGatePass.create({
        data: {
          companyId,
          gatePassNo: passNo,
          gatePassType: 'OUTWARD',
          fromWarehouse: order.warehouseName || 'Main Warehouse',
          destination: order.customerName,
          purpose: `Customer Dispatch for Order ${order.dispatchNo}`,
          referenceType: 'DISPATCH_ORDER',
          referenceId: order.id,
          referenceNo: order.dispatchNo,
          status: 'APPROVED',
          items: order.notes ? { notes: order.notes } : { dispatchNo: order.dispatchNo },
          issuedBy: actor.name || 'Security Desk',
        },
      });

      await tx.dispatchOrder.update({
        where: { id: order.id },
        data: {
          gatePassId: gatePass.id,
          gatePassNo: gatePass.gatePassNo,
          status: order.status === 'DRAFT' || order.status === 'PACKING' ? 'READY_FOR_DISPATCH' : order.status,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Security Officer',
        action: 'DISPATCH_GATE_PASS_CREATE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_orders',
        details: `Generated outward gate pass ${gatePass.gatePassNo} for Dispatch Order ${order.dispatchNo}.`,
      });

      return {
        gatePassId: gatePass.id,
        gatePassNo: gatePass.gatePassNo,
        status: gatePass.status,
      };
    });
  },

  // =========================================================================
  // 6. PHYSICAL DISPATCH EXECUTION & STOCK DEDUCTION
  // =========================================================================
  async executeDispatch(companyId, dispatchOrderId, data = {}, actor = {}) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
        include: {
          items: {
            include: {
              batchAllocations: true,
            },
          },
          salesOrder: true,
        },
      });

      if (!order) {
        throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
      }

      // IDEMPOTENCY GUARD: Prevent duplicate execution
      if (['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status)) {
        throw dispatchError(`Dispatch Order ${order.dispatchNo} has already been dispatched. Duplicate deduction prevented.`);
      }

      if (order.status === 'CANCELLED') {
        throw dispatchError(`Cannot dispatch cancelled order ${order.dispatchNo}.`);
      }

      // Check and execute batch allocations if missing
      for (const item of order.items) {
        let totalAllocated = item.batchAllocations.reduce((sum, a) => sum.add(a.allocatedQty), new Decimal(0));
        if (totalAllocated.lt(item.dispatchedQty)) {
          // Automatic FIFO allocation fallback
          const needed = Number(item.dispatchedQty.sub(totalAllocated));
          const now = new Date();
          const batchWhere = {
            companyId,
            sku: item.sku,
            status: 'ACTIVE',
            availableQty: { gt: 0 },
          };
          if (order.warehouseName) batchWhere.warehouse = order.warehouseName;

          const eligibleBatches = await tx.inventoryBatch.findMany({
            where: batchWhere,
            orderBy: [{ manufacturingDate: 'asc' }, { receivedDate: 'asc' }, { createdAt: 'asc' }],
          });

          const nonExpiredBatches = eligibleBatches.filter((b) => !b.expiryDate || new Date(b.expiryDate) > now);
          const totalAvailable = nonExpiredBatches.reduce((sum, b) => sum + b.availableQty, 0);

          if (totalAvailable < needed) {
            throw dispatchError(
              `Insufficient stock available for ${item.sku}. Required: ${needed}, Available: ${totalAvailable}.`,
              409
            );
          }

          let remaining = needed;
          for (const b of nonExpiredBatches) {
            if (remaining <= 0) break;
            const take = Math.min(b.availableQty, remaining);

            const alloc = await tx.dispatchItemBatchAllocation.create({
              data: {
                companyId,
                dispatchOrderItemId: item.id,
                inventoryBatchId: b.id,
                batchNo: b.batchNo,
                allocatedQty: new Decimal(take),
                unitCost: b.unitCost,
              },
            });

            item.batchAllocations.push(alloc);
            remaining -= take;
          }
        }
      }

      // Execute inventory deductions and ledger entries
      for (const item of order.items) {
        for (const alloc of item.batchAllocations) {
          const allocQty = Number(alloc.allocatedQty);

          const batch = await tx.inventoryBatch.findFirst({
            where: { id: alloc.inventoryBatchId, companyId },
          });

          if (!batch || batch.availableQty < allocQty) {
            throw dispatchError(
              `Batch ${alloc.batchNo} has insufficient available quantity (${batch ? batch.availableQty : 0} < ${allocQty}) for SKU ${item.sku}.`
            );
          }

          // Decrement batch availableQty
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              availableQty: { decrement: allocQty },
            },
          });

          // Decrement stock header
          const stock = await tx.inventoryStock.findFirst({
            where: { companyId, sku: item.sku, warehouse: batch.warehouse },
          });

          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                stock: { decrement: allocQty },
                availableQty: { decrement: allocQty },
              },
            });
          }

          // Create inventory movement ledger entry
          await tx.inventoryMovement.create({
            data: {
              companyId,
              stockId: stock ? stock.id : null,
              batchId: batch.id,
              batchNo: batch.batchNo,
              movementNo: documentNo('MOV'),
              movementType: 'SALES_DISPATCH',
              sku: item.sku,
              itemName: item.productName,
              warehouse: batch.warehouse,
              quantity: allocQty,
              balanceAfter: stock ? stock.stock - allocQty : batch.availableQty - allocQty,
              sourceBucket: 'AVAILABLE',
              destinationBucket: 'DISPATCHED_CUSTOMER',
              uom: item.uom,
              unitCost: Number(alloc.unitCost),
              referenceType: 'DISPATCH_ORDER',
              referenceId: order.id,
              referenceNo: order.dispatchNo,
              reason: `Dispatched to customer ${order.customerName} on ${order.dispatchNo}`,
              createdBy: actor.name || 'Dispatch Executive',
            },
          });
        }
      }

      // Update Dispatch Order status
      const updatedOrder = await tx.dispatchOrder.update({
        where: { id: order.id },
        data: {
          status: 'DISPATCHED',
          dispatchedAt: new Date(),
          dispatchedById: actor.id || actor.userId || null,
        },
      });

      // Update Sales Order status if fully fulfilled
      if (order.salesOrderId) {
        const allDispatches = await tx.dispatchOrder.findMany({
          where: { salesOrderId: order.salesOrderId, status: { not: 'CANCELLED' } },
          include: { items: true },
        });

        let totalDispatched = 0;
        for (const d of allDispatches) {
          for (const itm of d.items) {
            totalDispatched += Number(itm.dispatchedQty);
          }
        }

        // Check if all items in Sales Order are fulfilled
        let soTotalOrdered = 0;
        if (order.salesOrder && order.salesOrder.items) {
          let raw = [];
          if (Array.isArray(order.salesOrder.items)) raw = order.salesOrder.items;
          else {
            try { raw = JSON.parse(order.salesOrder.items); } catch { raw = []; }
          }
          soTotalOrdered = raw.reduce((sum, i) => sum + Number(i.quantity || i.qty || 1), 0);
        }

        const newSoStatus = totalDispatched >= soTotalOrdered && soTotalOrdered > 0
          ? 'FULFILLED'
          : 'PARTIALLY_DISPATCHED';

        await tx.salesOrder.update({
          where: { id: order.salesOrderId },
          data: { status: newSoStatus },
        });
      }

      // Create initial tracking event
      await tx.dispatchTracking.create({
        data: {
          companyId,
          dispatchOrderId: order.id,
          eventDate: new Date(),
          status: 'DISPATCHED',
          location: order.warehouseName || 'Main Warehouse',
          carrierStatus: 'Dispatched from Hub',
          remarks: `Shipment handed over to transporter ${order.carrierName || 'Carrier'}. Vehicle: ${order.vehicleNo || 'N/A'}.`,
          recordedBy: actor.name || 'Dispatch Manager',
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Dispatch Manager',
        action: 'DISPATCH_EXECUTE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_orders',
        details: `Executed physical dispatch of order ${order.dispatchNo}. Deducted stock across ${order.items.length} items.`,
      });

      return updatedOrder;
    });
  },

  async cancelDispatchOrder(companyId, dispatchOrderId, { reason }, actor = {}) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
      });

      if (!order) {
        throw dispatchError(`Dispatch Order not found with id ${dispatchOrderId}.`, 404);
      }

      if (['DISPATCHED', 'DELIVERED'].includes(order.status)) {
        throw dispatchError(`Cannot cancel Dispatch Order ${order.dispatchNo} because it is already ${order.status}.`);
      }

      // Delete batch allocations
      await tx.dispatchItemBatchAllocation.deleteMany({
        where: {
          dispatchOrderItem: {
            dispatchOrderId: order.id,
          },
        },
      });

      const updated = await tx.dispatchOrder.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          notes: order.notes ? `${order.notes}\nCancellation Reason: ${reason || 'N/A'}` : `Cancellation Reason: ${reason || 'N/A'}`,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Dispatch Supervisor',
        action: 'DISPATCH_CANCEL',
        serviceCode: 'dispatch_returns',
        moduleCode: 'dispatch_orders',
        details: `Cancelled Dispatch Order ${order.dispatchNo}. Reason: ${reason || 'Not provided'}.`,
      });

      return updated;
    });
  },
};

export default dispatchService;
