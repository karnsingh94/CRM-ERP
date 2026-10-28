import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.js';

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
  return actor?.email || actor?.name || actor?.role || null;
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
      movementNo: documentNo('MOV'),
      movementType: data.movementType,
      sku: data.sku,
      itemName: data.itemName,
      warehouse: data.warehouse,
      quantity: data.quantity,
      balanceAfter: data.balanceAfter,
      uom: data.uom || 'PCS',
      unitCost: Number(data.unitCost) || 0,
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      referenceNo: data.referenceNo || null,
      reason: data.reason || null,
      notes: data.notes || null,
      createdBy: data.createdBy || null,
    },
  });
}

async function consumeStock(client, { companyId, sku, quantity, movementType, referenceType, referenceId, referenceNo, reason, notes, createdBy }) {
  let remaining = quantity;
  const stocks = await client.inventoryStock.findMany({
    where: { companyId, sku, stock: { gt: 0 } },
    orderBy: [{ createdAt: 'asc' }, { warehouse: 'asc' }],
  });

  if (stocks.reduce((sum, row) => sum + row.stock, 0) < quantity) {
    throw inventoryError(`Insufficient stock for ${sku}. Required ${quantity}.`, 409);
  }

  for (const stock of stocks) {
    if (remaining <= 0) break;
    const take = Math.min(stock.stock, remaining);
    const updated = await client.inventoryStock.updateMany({
      where: { id: stock.id, companyId, stock: { gte: take } },
      data: { stock: { decrement: take } },
    });
    if (updated.count !== 1) {
      throw inventoryError(`Stock for ${sku} changed while processing. Please retry.`, 409);
    }
    const balanceAfter = stock.stock - take;
    await createMovement(client, {
      companyId,
      stockId: stock.id,
      movementType,
      sku,
      itemName: stock.name,
      warehouse: stock.warehouse,
      quantity: -take,
      balanceAfter,
      uom: stock.uom,
      unitCost: stock.averageCost,
      referenceType,
      referenceId,
      referenceNo,
      reason,
      notes,
      createdBy,
    });
    remaining -= take;
  }
  await syncProductStock(client, companyId, sku);
}

async function receiveStock(client, { companyId, sku, name, quantity, warehouse, uom, itemType, unitCost, binLocation, movementType, referenceType, referenceId, referenceNo, reason, notes, createdBy }) {
  let stock = await client.inventoryStock.findFirst({ where: { companyId, sku, warehouse } });
  if (!stock) {
    const product = itemType === 'FINISHED_GOOD'
      ? await client.product.findFirst({ where: { companyId, sku } })
      : null;
    stock = await client.inventoryStock.create({
      data: {
        companyId,
        productId: product?.id || null,
        sku,
        name,
        warehouse,
        stock: 0,
        reorderLevel: 10,
        uom: uom || 'PCS',
        itemType: itemType || 'RAW_MATERIAL',
        binLocation: binLocation || null,
        averageCost: Number(unitCost) || 0,
      },
    });
  }

  const oldQty = stock.stock;
  const incomingCost = Number(unitCost) || 0;
  const previousCost = Number(stock.averageCost) || 0;
  const averageCost = incomingCost > 0
    ? ((oldQty * previousCost) + (quantity * incomingCost)) / (oldQty + quantity)
    : previousCost;
  const updated = await client.inventoryStock.update({
    where: { id: stock.id },
    data: {
      stock: { increment: quantity },
      averageCost,
      itemType: itemType || stock.itemType,
      ...(binLocation ? { binLocation } : {}),
    },
  });
  await createMovement(client, {
    companyId,
    stockId: stock.id,
    movementType,
    sku,
    itemName: name,
    warehouse,
    quantity,
    balanceAfter: updated.stock,
    uom: uom || stock.uom,
    unitCost: incomingCost,
    referenceType,
    referenceId,
    referenceNo,
    reason,
    notes,
    createdBy,
  });
  await syncProductStock(client, companyId, sku);
  return updated;
}

async function consumeWarehouseStock(client, { companyId, sku, warehouse, quantity, movementType, referenceType, referenceId, referenceNo, reason, notes, createdBy }) {
  const stock = await client.inventoryStock.findFirst({ where: { companyId, sku, warehouse } });
  if (!stock) throw inventoryError(`${sku} is not available in ${warehouse}.`, 404);
  if (stock.stock < quantity) throw inventoryError(`${warehouse} has only ${stock.stock} ${stock.uom} of ${sku}.`, 409);
  const updated = await client.inventoryStock.updateMany({
    where: { id: stock.id, companyId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (updated.count !== 1) throw inventoryError(`Stock for ${sku} changed while processing. Please retry.`, 409);
  await createMovement(client, {
    companyId,
    stockId: stock.id,
    movementType,
    sku,
    itemName: stock.name,
    warehouse,
    quantity: -quantity,
    balanceAfter: stock.stock - quantity,
    uom: stock.uom,
    unitCost: stock.averageCost,
    referenceType,
    referenceId,
    referenceNo,
    reason,
    notes,
    createdBy,
  });
  await syncProductStock(client, companyId, sku);
  return stock;
}

async function resolveSalesOrderItems(client, companyId, order) {
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw inventoryError(`Sales order ${order.orderNo} has no line-item details to fulfil.`);
  }

  const resolved = [];
  for (const line of order.items) {
    const name = String(line.item || line.name || line.description || '').trim();
    const qty = positiveInt(line.qty || line.quantity, `Quantity for ${name || 'sales item'}`);
    if (!name) throw inventoryError(`Sales order ${order.orderNo} contains an unnamed item.`);

    const product = await client.product.findFirst({
      where: { companyId, OR: [{ sku: cleanSku(line.sku || name) }, { name }] },
    });
    const stock = await client.inventoryStock.findFirst({
      where: { companyId, OR: [{ sku: product?.sku || cleanSku(line.sku || name) }, { name }] },
      orderBy: { createdAt: 'asc' },
    });
    const sku = product?.sku || stock?.sku || cleanSku(line.sku || name);
    if (!sku) throw inventoryError(`Could not determine an SKU for ${name}.`);
    const existing = resolved.find((item) => item.sku === sku);
    if (existing) existing.qty += qty;
    else resolved.push({ sku, name: product?.name || stock?.name || name, qty, uom: product?.uom || stock?.uom || 'PCS' });
  }
  return resolved;
}

async function shortagesFor(client, companyId, items) {
  const shortages = [];
  for (const item of items) {
    const available = await stockTotal(client, companyId, item.sku);
    if (available < item.qty) shortages.push({ ...item, available, shortage: item.qty - available });
  }
  return shortages;
}

async function attemptDispatch(client, companyId, fulfillment, createdBy) {
  if (fulfillment.status === 'FULFILLED') return fulfillment;
  const items = Array.isArray(fulfillment.requestedItems) ? fulfillment.requestedItems : [];
  const shortages = await shortagesFor(client, companyId, items);
  if (shortages.length) {
    return client.inventoryFulfillment.update({
      where: { id: fulfillment.id },
      data: { shortageItems: shortages, status: 'MANUFACTURING_REQUIRED', processedAt: new Date() },
    });
  }

  for (const item of items) {
    await consumeStock(client, {
      companyId,
      sku: item.sku,
      quantity: item.qty,
      movementType: 'SALES_DISPATCH',
      referenceType: 'SALES_ORDER',
      referenceId: fulfillment.salesOrderId,
      referenceNo: fulfillment.orderNo,
      reason: 'Sales order fulfilled from inventory',
      createdBy,
    });
  }
  return client.inventoryFulfillment.update({
    where: { id: fulfillment.id },
    data: { shortageItems: [], status: 'FULFILLED', processedAt: new Date(), fulfilledAt: new Date() },
  });
}

async function refreshMaterialRequestReadiness(client, request) {
  const materials = Array.isArray(request.rawMaterials) ? request.rawMaterials : [];
  if (!materials.length) return request;
  const shortages = await shortagesFor(client, request.companyId, materials);
  const status = shortages.length ? 'WAITING_PURCHASE' : 'READY_FOR_ISSUE';
  return client.inventoryMaterialRequest.update({ where: { id: request.id }, data: { status } });
}

export const inventoryService = {
  async dashboard(companyId) {
    const [stocks, openOrders, openMaterials, openPurchases, warehouses, movementGroups, recentMovements] = await Promise.all([
      prisma.inventoryStock.findMany({ where: { companyId } }),
      prisma.inventoryFulfillment.count({ where: { companyId, status: { not: 'FULFILLED' } } }),
      prisma.inventoryMaterialRequest.count({ where: { companyId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      prisma.inventoryProcurementRequest.count({ where: { companyId, status: { not: 'RECEIVED' } } }),
      prisma.inventoryWarehouse.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.inventoryMovement.groupBy({ by: ['movementType'], where: { companyId }, _sum: { quantity: true } }),
      prisma.inventoryMovement.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    const movementTotals = Object.fromEntries(movementGroups.map((row) => [row.movementType, Math.abs(row._sum.quantity || 0)]));
    return {
      totalSkus: stocks.length,
      totalUnits: stocks.reduce((sum, row) => sum + row.stock, 0),
      lowStock: stocks.filter((row) => row.stock <= row.reorderLevel).length,
      stockValue: stocks.reduce((sum, row) => sum + (row.stock * Number(row.averageCost)), 0),
      openOrders,
      openMaterials,
      openPurchases,
      warehouses,
      movementTotals,
      recentMovements,
    };
  },

  listStocks(companyId, options = {}) {
    const where = { companyId };
    if (options.itemType && options.itemType !== 'ALL') where.itemType = options.itemType;
    if (options.warehouse && options.warehouse !== 'ALL') where.warehouse = options.warehouse;
    if (options.search?.trim()) {
      where.OR = [{ sku: { contains: options.search.trim() } }, { name: { contains: options.search.trim() } }];
    }
    return prisma.inventoryStock.findMany({
      where,
      include: { product: { select: { id: true, sellingPrice: true, status: true } }, bin: true },
      orderBy: [{ name: 'asc' }, { warehouse: 'asc' }],
    });
  },

  async listProducts(companyId) {
    const products = await prisma.product.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { inventoryStocks: { select: { stock: true, reservedStock: true, warehouse: true, binLocation: true } } },
      orderBy: { name: 'asc' },
    });
    return products.map((product) => ({
      ...product,
      inventoryQty: product.inventoryStocks.reduce((sum, stock) => sum + stock.stock, 0),
      availableQty: product.inventoryStocks.reduce((sum, stock) => sum + stock.stock - stock.reservedStock, 0),
      warehouseCount: new Set(product.inventoryStocks.map((stock) => stock.warehouse)).size,
    }));
  },

  async createStock(companyId, data, actor) {
    const product = data.productId
      ? await prisma.product.findFirst({ where: { id: String(data.productId), companyId, status: 'ACTIVE' } })
      : null;
    if (data.productId && !product) throw inventoryError('Selected product was not found in this company.', 404);
    let warehouse = String(data.warehouse || 'Main Warehouse').trim();
    let bin = null;
    if (data.binId) {
      bin = await prisma.inventoryBin.findFirst({
        where: { id: String(data.binId), companyId, status: 'ACTIVE' },
        include: { warehouse: true },
      });
      if (!bin) throw inventoryError('Selected bin/rack was not found.', 404);
      warehouse = bin.warehouse.name;
    }
    const sku = product?.sku || cleanSku(data.sku);
    const name = product?.name || String(data.name || '').trim();
    if (!sku || !name) throw inventoryError('SKU and item name are required.');
    const openingStock = nonNegativeInt(data.stock ?? 0, 'Opening stock');
    const reorderLevel = nonNegativeInt(data.reorderLevel ?? 10, 'Reorder level');
    const existing = await prisma.inventoryStock.findFirst({ where: { companyId, sku, warehouse } });
    if (existing) throw inventoryError(`${sku} already exists in ${warehouse}.`, 409);

    return prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.create({
        data: {
          companyId,
          productId: product?.id || null,
          binId: bin?.id || null,
          sku,
          name,
          warehouse,
          stock: openingStock,
          reorderLevel,
          uom: String(product?.uom || data.uom || 'PCS').trim().toUpperCase(),
          itemType: String(product ? 'FINISHED_GOOD' : data.itemType || 'RAW_MATERIAL').trim().toUpperCase(),
          binLocation: bin?.code || String(data.binLocation || '').trim() || null,
          averageCost: Number(data.averageCost ?? product?.purchasePrice) || 0,
        },
      });
      if (openingStock > 0) {
        await createMovement(tx, {
          companyId,
          stockId: stock.id,
          movementType: 'OPENING_BALANCE',
          sku,
          itemName: name,
          warehouse,
          quantity: openingStock,
          balanceAfter: openingStock,
          uom: stock.uom,
          unitCost: stock.averageCost,
          reason: 'Opening inventory balance',
          createdBy: actorName(actor),
        });
      }
      await syncProductStock(tx, companyId, sku);
      return stock;
    });
  },

  async adjustStock(companyId, stockId, data, actor) {
    const diff = Number.parseInt(data.qtyDiff, 10);
    if (!Number.isInteger(diff) || diff === 0) throw inventoryError('Quantity change must be a non-zero whole number.');
    const reason = String(data.reason || '').trim();
    if (!reason) throw inventoryError('Adjustment reason is required.');
    return prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryStock.findFirst({ where: { id: stockId, companyId } });
      if (!existing) throw inventoryError('Stock item not found.', 404);
      if (existing.stock + diff < 0) throw inventoryError(`Adjustment would make ${existing.sku} stock negative.`, 409);
      const updated = await tx.inventoryStock.update({ where: { id: stockId }, data: { stock: { increment: diff } } });
      await createMovement(tx, {
        companyId,
        stockId,
        movementType: 'STOCK_ADJUSTMENT',
        sku: existing.sku,
        itemName: existing.name,
        warehouse: existing.warehouse,
        quantity: diff,
        balanceAfter: updated.stock,
        uom: existing.uom,
        unitCost: existing.averageCost,
        reason,
        notes: String(data.notes || '').trim() || null,
        createdBy: actorName(actor),
      });
      await syncProductStock(tx, companyId, existing.sku);
      return updated;
    });
  },

  async updateStockLocation(companyId, stockId, data) {
    const stock = await prisma.inventoryStock.findFirst({ where: { id: stockId, companyId } });
    if (!stock) throw inventoryError('Stock item not found.', 404);
    if (!data.binId) {
      return prisma.inventoryStock.update({ where: { id: stockId }, data: { binId: null, binLocation: null } });
    }
    const bin = await prisma.inventoryBin.findFirst({
      where: { id: String(data.binId), companyId, status: 'ACTIVE' },
      include: { warehouse: true },
    });
    if (!bin) throw inventoryError('Selected bin/rack was not found.', 404);
    if (bin.warehouse.name !== stock.warehouse) {
      throw inventoryError(`This stock is in ${stock.warehouse}. Select a bin from the same warehouse.`, 409);
    }
    return prisma.inventoryStock.update({
      where: { id: stockId },
      data: { binId: bin.id, binLocation: bin.code },
      include: { bin: true },
    });
  },

  listWarehouses(companyId) {
    return prisma.inventoryWarehouse.findMany({
      where: { companyId },
      include: { bins: { where: { status: 'ACTIVE' }, orderBy: { code: 'asc' } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  },

  async createWarehouse(companyId, data) {
    const code = cleanSku(data.code);
    const name = String(data.name || '').trim();
    if (!code || !name) throw inventoryError('Warehouse code and name are required.');
    const duplicate = await prisma.inventoryWarehouse.findFirst({ where: { companyId, OR: [{ code }, { name }] } });
    if (duplicate) throw inventoryError('A warehouse with this code or name already exists.', 409);
    return prisma.$transaction(async (tx) => {
      const count = await tx.inventoryWarehouse.count({ where: { companyId } });
      const isDefault = Boolean(data.isDefault) || count === 0;
      if (isDefault) await tx.inventoryWarehouse.updateMany({ where: { companyId }, data: { isDefault: false } });
      return tx.inventoryWarehouse.create({
        data: {
          companyId,
          code,
          name,
          address: String(data.address || '').trim() || null,
          contactName: String(data.contactName || '').trim() || null,
          contactPhone: String(data.contactPhone || '').trim() || null,
          isDefault,
        },
      });
    });
  },

  async createBin(companyId, warehouseId, data) {
    const warehouse = await prisma.inventoryWarehouse.findFirst({ where: { id: warehouseId, companyId, status: 'ACTIVE' } });
    if (!warehouse) throw inventoryError('Warehouse not found.', 404);
    const code = cleanSku(data.code);
    if (!code) throw inventoryError('Bin/rack code is required.');
    const duplicate = await prisma.inventoryBin.findFirst({ where: { warehouseId, code } });
    if (duplicate) throw inventoryError(`${code} already exists in ${warehouse.name}.`, 409);
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

  listTransfers(companyId) {
    return prisma.inventoryTransfer.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  },

  async createTransfer(companyId, data, actor) {
    const fromWarehouse = String(data.fromWarehouse || '').trim();
    const toWarehouse = String(data.toWarehouse || '').trim();
    if (!fromWarehouse || !toWarehouse) throw inventoryError('Source and destination warehouses are required.');
    if (fromWarehouse === toWarehouse) throw inventoryError('Source and destination warehouses must be different.');
    if (!Array.isArray(data.items) || data.items.length === 0) throw inventoryError('Add at least one item to transfer.');
    const warehouseCount = await prisma.inventoryWarehouse.count({ where: { companyId, name: { in: [fromWarehouse, toWarehouse] }, status: 'ACTIVE' } });
    if (warehouseCount !== 2) throw inventoryError('Both warehouses must be active warehouse records.', 409);

    return prisma.$transaction(async (tx) => {
      const normalized = [];
      for (const [index, item] of data.items.entries()) {
        const sku = cleanSku(item.sku);
        const qty = positiveInt(item.qty, `Transfer item ${index + 1} quantity`);
        const stock = await tx.inventoryStock.findFirst({ where: { companyId, sku, warehouse: fromWarehouse } });
        if (!stock) throw inventoryError(`${sku || `Item ${index + 1}`} is not available in ${fromWarehouse}.`, 404);
        const existing = normalized.find((line) => line.sku === sku);
        if (existing) existing.qty += qty;
        else normalized.push({ sku, name: stock.name, qty, uom: stock.uom, itemType: stock.itemType, unitCost: Number(stock.averageCost) });
      }
      const transfer = await tx.inventoryTransfer.create({
        data: {
          companyId,
          transferNo: documentNo('TRF'),
          fromWarehouse,
          toWarehouse,
          items: normalized,
          status: 'IN_TRANSIT',
          notes: String(data.notes || '').trim() || null,
          createdBy: actorName(actor),
        },
      });
      for (const item of normalized) {
        await consumeWarehouseStock(tx, {
          companyId,
          sku: item.sku,
          warehouse: fromWarehouse,
          quantity: item.qty,
          movementType: 'WAREHOUSE_TRANSFER_OUT',
          referenceType: 'WAREHOUSE_TRANSFER',
          referenceId: transfer.id,
          referenceNo: transfer.transferNo,
          reason: `Sent to ${toWarehouse}`,
          notes: transfer.notes,
          createdBy: actorName(actor),
        });
      }
      return transfer;
    });
  },

  async receiveTransfer(companyId, transferId, actor) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.inventoryTransfer.findFirst({ where: { id: transferId, companyId } });
      if (!transfer) throw inventoryError('Warehouse transfer not found.', 404);
      if (transfer.status === 'RECEIVED') return transfer;
      if (transfer.status !== 'IN_TRANSIT') throw inventoryError('Only an in-transit transfer can be received.', 409);
      const items = Array.isArray(transfer.items) ? transfer.items : [];
      for (const item of items) {
        await receiveStock(tx, {
          companyId,
          sku: item.sku,
          name: item.name,
          quantity: item.qty,
          warehouse: transfer.toWarehouse,
          uom: item.uom,
          itemType: item.itemType,
          unitCost: item.unitCost,
          movementType: 'WAREHOUSE_TRANSFER_IN',
          referenceType: 'WAREHOUSE_TRANSFER',
          referenceId: transfer.id,
          referenceNo: transfer.transferNo,
          reason: `Received from ${transfer.fromWarehouse}`,
          notes: transfer.notes,
          createdBy: actorName(actor),
        });
      }
      return tx.inventoryTransfer.update({
        where: { id: transfer.id },
        data: { status: 'RECEIVED', receivedAt: new Date(), receivedBy: actorName(actor) },
      });
    });
  },

  listMovements(companyId, options = {}) {
    const where = { companyId };
    if (options.type && options.type !== 'ALL') where.movementType = options.type;
    if (options.sku?.trim()) where.sku = { contains: options.sku.trim() };
    return prisma.inventoryMovement.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(options.limit) || 200, 500) });
  },

  async listSalesOrders(companyId) {
    const orders = await prisma.salesOrder.findMany({
      where: { companyId, status: { in: ['APPROVED', 'CONFIRMED'] } },
      include: { inventoryFulfillment: { include: { materialRequests: true } } },
      orderBy: { date: 'desc' },
    });
    return orders;
  },

  async processSalesOrder(companyId, salesOrderId, actor) {
    const order = await prisma.salesOrder.findFirst({ where: { id: salesOrderId, companyId } });
    if (!order) throw inventoryError('Approved sales order not found.', 404);
    if (!['APPROVED', 'CONFIRMED'].includes(order.status)) {
      throw inventoryError('Only approved or confirmed sales orders can be processed.', 409);
    }

    return prisma.$transaction(async (tx) => {
      let fulfillment = await tx.inventoryFulfillment.findUnique({ where: { salesOrderId } });
      if (fulfillment?.status === 'FULFILLED') return fulfillment;
      const items = fulfillment?.requestedItems || await resolveSalesOrderItems(tx, companyId, order);
      const shortages = await shortagesFor(tx, companyId, items);

      if (!fulfillment) {
        fulfillment = await tx.inventoryFulfillment.create({
          data: {
            companyId,
            salesOrderId,
            orderNo: order.orderNo,
            customer: order.customer,
            requestedItems: items,
            shortageItems: shortages,
            status: shortages.length ? 'MANUFACTURING_REQUIRED' : 'STOCK_READY',
            processedAt: new Date(),
          },
        });
      } else {
        fulfillment = await tx.inventoryFulfillment.update({
          where: { id: fulfillment.id },
          data: { shortageItems: shortages, status: shortages.length ? 'MANUFACTURING_REQUIRED' : 'STOCK_READY', processedAt: new Date() },
        });
      }

      if (!shortages.length) return attemptDispatch(tx, companyId, fulfillment, actorName(actor));

      for (const shortage of shortages) {
        const existingRequest = await tx.inventoryMaterialRequest.findFirst({
          where: { fulfillmentId: fulfillment.id, productSku: shortage.sku, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        });
        if (!existingRequest) {
          await tx.inventoryMaterialRequest.create({
            data: {
              companyId,
              fulfillmentId: fulfillment.id,
              requestNo: documentNo('MR'),
              productSku: shortage.sku,
              productName: shortage.name,
              requestedQty: shortage.shortage,
              uom: shortage.uom,
              status: 'MATERIAL_LIST_PENDING',
              notes: `Auto-created for sales order ${order.orderNo}`,
            },
          });
        }
      }
      return tx.inventoryFulfillment.findUnique({
        where: { id: fulfillment.id },
        include: { materialRequests: true },
      });
    });
  },

  listMaterialRequests(companyId) {
    return prisma.inventoryMaterialRequest.findMany({
      where: { companyId },
      include: {
        fulfillment: { select: { orderNo: true, customer: true, status: true } },
        procurements: { orderBy: { createdAt: 'desc' } },
        productionReceipt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async submitMaterialList(companyId, requestId, data) {
    if (!Array.isArray(data.materials) || data.materials.length === 0) {
      throw inventoryError('At least one raw material is required.');
    }
    const materials = data.materials.map((line, index) => ({
      sku: cleanSku(line.sku),
      name: String(line.name || '').trim(),
      qty: positiveInt(line.qty, `Material ${index + 1} quantity`),
      uom: String(line.uom || 'PCS').trim().toUpperCase(),
    }));
    if (materials.some((line) => !line.sku || !line.name)) throw inventoryError('Every raw material needs an SKU and name.');

    return prisma.$transaction(async (tx) => {
      let request = await tx.inventoryMaterialRequest.findFirst({ where: { id: requestId, companyId } });
      if (!request) throw inventoryError('Manufacturing material request not found.', 404);
      if (['MATERIAL_ISSUED', 'COMPLETED'].includes(request.status)) {
        throw inventoryError('Material list cannot be changed after issue to production.', 409);
      }

      const shortages = await shortagesFor(tx, companyId, materials);
      const existingPurchases = await tx.inventoryProcurementRequest.findMany({ where: { materialRequestId: requestId } });
      if (existingPurchases.some((purchase) => purchase.receivedQty > 0)) {
        throw inventoryError('Raw-material list cannot be changed after a purchase receipt has been posted.', 409);
      }
      await tx.inventoryProcurementRequest.updateMany({
        where: { materialRequestId: requestId, receivedQty: 0, status: { in: ['PENDING_PURCHASE', 'PARTIALLY_RECEIVED'] } },
        data: { status: 'CANCELLED' },
      });
      request = await tx.inventoryMaterialRequest.update({
        where: { id: requestId },
        data: { rawMaterials: materials, status: shortages.length ? 'WAITING_PURCHASE' : 'READY_FOR_ISSUE', notes: String(data.notes || request.notes || '').trim() || null },
      });

      for (const shortage of shortages) {
        await tx.inventoryProcurementRequest.create({
          data: {
            companyId,
            materialRequestId: requestId,
            requestNo: documentNo('PR'),
            sku: shortage.sku,
            itemName: shortage.name,
            requiredQty: shortage.shortage,
            uom: shortage.uom,
            status: 'PENDING_PURCHASE',
            notes: `Shortage for ${request.requestNo}`,
          },
        });
      }
      return tx.inventoryMaterialRequest.findUnique({ where: { id: requestId }, include: { procurements: true } });
    });
  },

  async issueMaterials(companyId, requestId, actor) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.inventoryMaterialRequest.findFirst({ where: { id: requestId, companyId } });
      if (!request) throw inventoryError('Manufacturing material request not found.', 404);
      if (request.status === 'MATERIAL_ISSUED') return request;
      if (!Array.isArray(request.rawMaterials) || request.rawMaterials.length === 0) {
        throw inventoryError('Production must submit the raw-material list before issue.', 409);
      }
      const shortages = await shortagesFor(tx, companyId, request.rawMaterials);
      if (shortages.length) throw inventoryError(`Raw materials are still short: ${shortages.map((line) => `${line.sku} (${line.shortage})`).join(', ')}`, 409);
      for (const material of request.rawMaterials) {
        await consumeStock(tx, {
          companyId,
          sku: material.sku,
          quantity: material.qty,
          movementType: 'PRODUCTION_ISSUE',
          referenceType: 'MATERIAL_REQUEST',
          referenceId: request.id,
          referenceNo: request.requestNo,
          reason: `Issued for production of ${request.productName}`,
          createdBy: actorName(actor),
        });
      }
      return tx.inventoryMaterialRequest.update({ where: { id: requestId }, data: { status: 'MATERIAL_ISSUED', issuedAt: new Date() } });
    });
  },

  listProcurements(companyId) {
    return prisma.inventoryProcurementRequest.findMany({
      where: { companyId },
      include: { materialRequest: { select: { requestNo: true, productName: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async receivePurchase(companyId, procurementId, data, actor) {
    return prisma.$transaction(async (tx) => {
      const procurement = await tx.inventoryProcurementRequest.findFirst({ where: { id: procurementId, companyId } });
      if (!procurement) throw inventoryError('Purchase request not found.', 404);
      const receivedQty = positiveInt(data.receivedQty, 'Received quantity');
      const outstanding = procurement.requiredQty - procurement.receivedQty;
      if (receivedQty > outstanding) throw inventoryError(`Only ${outstanding} ${procurement.uom} are outstanding on this request.`, 409);
      const warehouse = String(data.warehouse || 'Main Warehouse').trim();
      const vendorName = String(data.vendorName || '').trim();
      if (!vendorName) throw inventoryError('Vendor name is required for purchase receipt.');

      const stock = await receiveStock(tx, {
        companyId,
        sku: procurement.sku,
        name: procurement.itemName,
        quantity: receivedQty,
        warehouse,
        uom: procurement.uom,
        itemType: 'RAW_MATERIAL',
        unitCost: Number(data.unitCost) || 0,
        movementType: 'PURCHASE_RECEIPT',
        referenceType: 'PROCUREMENT_REQUEST',
        referenceId: procurement.id,
        referenceNo: procurement.requestNo,
        reason: `Purchased from ${vendorName}`,
        notes: String(data.notes || '').trim() || null,
        createdBy: actorName(actor),
      });
      const totalReceived = procurement.receivedQty + receivedQty;
      const updated = await tx.inventoryProcurementRequest.update({
        where: { id: procurement.id },
        data: {
          receivedQty: totalReceived,
          vendorName,
          unitCost: Number(data.unitCost) || procurement.unitCost,
          status: totalReceived === procurement.requiredQty ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
          receivedAt: totalReceived === procurement.requiredQty ? new Date() : null,
          notes: String(data.notes || procurement.notes || '').trim() || null,
        },
      });
      const materialRequest = await tx.inventoryMaterialRequest.findUnique({ where: { id: procurement.materialRequestId } });
      await refreshMaterialRequestReadiness(tx, materialRequest);
      return { procurement: updated, stock };
    });
  },

  async receiveProduction(companyId, requestId, data, actor) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.inventoryMaterialRequest.findFirst({
        where: { id: requestId, companyId },
        include: { fulfillment: true, productionReceipt: true },
      });
      if (!request) throw inventoryError('Manufacturing material request not found.', 404);
      if (request.productionReceipt) throw inventoryError('Production receipt is already recorded for this request.', 409);
      if (request.status !== 'MATERIAL_ISSUED') throw inventoryError('Raw materials must be issued before production can be received.', 409);
      const producedQty = positiveInt(data.producedQty, 'Produced quantity');
      const wasteQty = nonNegativeInt(data.wasteQty ?? 0, 'Wastage quantity');
      const warehouse = String(data.warehouse || 'Main Warehouse').trim();
      const receiptNo = documentNo('PRD');
      const issuedMaterials = Array.isArray(request.rawMaterials) ? request.rawMaterials : [];
      const returnedMaterials = Array.isArray(data.returnedMaterials)
        ? data.returnedMaterials
          .map((line) => ({ sku: cleanSku(line.sku), qty: nonNegativeInt(line.qty ?? 0, `Returned quantity for ${line.sku || 'material'}`) }))
          .filter((line) => line.qty > 0)
        : [];
      for (const returned of returnedMaterials) {
        const issued = issuedMaterials.find((line) => line.sku === returned.sku);
        if (!issued) throw inventoryError(`${returned.sku} was not issued for this production request.`, 409);
        if (returned.qty > issued.qty) throw inventoryError(`Returned ${returned.sku} cannot exceed issued quantity ${issued.qty}.`, 409);
        await receiveStock(tx, {
          companyId,
          sku: issued.sku,
          name: issued.name,
          quantity: returned.qty,
          warehouse,
          uom: issued.uom,
          itemType: 'RAW_MATERIAL',
          unitCost: 0,
          movementType: 'PRODUCTION_RETURN',
          referenceType: 'MATERIAL_REQUEST',
          referenceId: request.id,
          referenceNo: request.requestNo,
          reason: 'Unused material returned by production',
          createdBy: actorName(actor),
        });
      }
      const consumedMaterials = issuedMaterials.map((issued) => {
        const returned = returnedMaterials.find((line) => line.sku === issued.sku);
        return { ...issued, consumedQty: Math.max(0, issued.qty - (returned?.qty || 0)), returnedQty: returned?.qty || 0 };
      });

      const stock = await receiveStock(tx, {
        companyId,
        sku: request.productSku,
        name: request.productName,
        quantity: producedQty,
        warehouse,
        uom: request.uom,
        itemType: 'FINISHED_GOOD',
        unitCost: Number(data.unitCost) || 0,
        movementType: 'PRODUCTION_RECEIPT',
        referenceType: 'MATERIAL_REQUEST',
        referenceId: request.id,
        referenceNo: request.requestNo,
        reason: 'Finished goods received from production',
        notes: String(data.notes || '').trim() || null,
        createdBy: actorName(actor),
      });
      const receipt = await tx.inventoryProductionReceipt.create({
        data: {
          companyId,
          materialRequestId: request.id,
          receiptNo,
          productSku: request.productSku,
          productName: request.productName,
          producedQty,
          wasteQty,
          wasteReason: String(data.wasteReason || '').trim() || null,
          rawMaterialConsumed: consumedMaterials,
          returnedMaterials,
          warehouse,
          notes: String(data.notes || '').trim() || null,
        },
      });
      if (wasteQty > 0) {
        await createMovement(tx, {
          companyId,
          stockId: stock.id,
          movementType: 'PRODUCTION_WASTAGE',
          sku: request.productSku,
          itemName: request.productName,
          warehouse,
          quantity: wasteQty,
          balanceAfter: stock.stock,
          uom: request.uom,
          referenceType: 'PRODUCTION_RECEIPT',
          referenceId: receipt.id,
          referenceNo: receiptNo,
          reason: String(data.wasteReason || 'Production wastage').trim(),
          createdBy: actorName(actor),
        });
      }
      await tx.inventoryMaterialRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      const fulfillment = await attemptDispatch(tx, companyId, request.fulfillment, actorName(actor));
      if (fulfillment.status !== 'FULFILLED') {
        const remainingShortages = Array.isArray(fulfillment.shortageItems) ? fulfillment.shortageItems : [];
        for (const shortage of remainingShortages) {
          const activeRequest = await tx.inventoryMaterialRequest.findFirst({
            where: {
              fulfillmentId: fulfillment.id,
              productSku: shortage.sku,
              status: { notIn: ['CANCELLED', 'COMPLETED'] },
            },
          });
          if (!activeRequest) {
            await tx.inventoryMaterialRequest.create({
              data: {
                companyId,
                fulfillmentId: fulfillment.id,
                requestNo: documentNo('MR'),
                productSku: shortage.sku,
                productName: shortage.name,
                requestedQty: shortage.shortage,
                uom: shortage.uom,
                status: 'MATERIAL_LIST_PENDING',
                notes: `Remaining production shortage for sales order ${fulfillment.orderNo}`,
              },
            });
          }
        }
      }
      return { receipt, fulfillment };
    });
  },
};

export default inventoryService;
