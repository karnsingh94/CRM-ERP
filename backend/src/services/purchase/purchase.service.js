import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.js';

function purchaseError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function documentNo(prefix) {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

function actorName(actor) {
  return actor?.email || actor?.name || actor?.role || null;
}

function cleanSku(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function positiveInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw purchaseError(`${field} must be a positive whole number.`);
  return parsed;
}

function nonNegativeInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) throw purchaseError(`${field} must be zero or a positive whole number.`);
  return parsed;
}

function nonNegativeMoney(value, field) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw purchaseError(`${field} must be zero or a positive amount.`);
  return Number(parsed.toFixed(2));
}

function parseDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw purchaseError(`${field} is invalid.`);
  return date;
}

function normalizeRequestItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw purchaseError('Add at least one material to the purchase request.');
  const normalized = [];
  for (const [index, item] of items.entries()) {
    const sku = cleanSku(item.sku || item.name);
    const name = String(item.name || '').trim();
    if (!sku || !name) throw purchaseError(`Material ${index + 1} requires an SKU and name.`);
    const qty = positiveInt(item.qty, `Quantity for ${name}`);
    const existing = normalized.find((line) => line.sku === sku);
    if (existing) existing.qty += qty;
    else normalized.push({ sku, name, qty, uom: String(item.uom || 'PCS').trim().toUpperCase() || 'PCS', specification: String(item.specification || '').trim() || null });
  }
  return normalized;
}

function normalizeQuoteItems(requestItems, quoteItems) {
  if (!Array.isArray(quoteItems)) throw purchaseError('Add vendor rates for every requested material.');
  return requestItems.map((requestItem) => {
    const quoteItem = quoteItems.find((line) => cleanSku(line.sku) === requestItem.sku);
    if (!quoteItem) throw purchaseError(`Vendor rate is missing for ${requestItem.sku}.`);
    const unitRate = nonNegativeMoney(quoteItem.unitRate, `Rate for ${requestItem.sku}`);
    if (unitRate <= 0) throw purchaseError(`Rate for ${requestItem.sku} must be greater than zero.`);
    return { ...requestItem, unitRate, amount: Number((requestItem.qty * unitRate).toFixed(2)) };
  });
}

async function syncProductStock(client, companyId, sku) {
  const product = await client.product.findFirst({ where: { companyId, sku }, select: { id: true } });
  if (!product) return;
  const aggregate = await client.inventoryStock.aggregate({ where: { companyId, sku }, _sum: { stock: true } });
  await client.product.update({ where: { id: product.id }, data: { stock: aggregate._sum.stock || 0 } });
}

async function receiveWarehouseStock(client, { companyId, sku, name, qty, uom, warehouse, unitCost, receipt, vendorName, createdBy }) {
  let stock = await client.inventoryStock.findFirst({ where: { companyId, sku, warehouse } });
  if (!stock) {
    const product = await client.product.findFirst({ where: { companyId, sku }, select: { id: true } });
    stock = await client.inventoryStock.create({
      data: {
        companyId,
        productId: product?.id || null,
        sku,
        name,
        warehouse,
        stock: 0,
        reorderLevel: 10,
        uom,
        itemType: product ? 'FINISHED_GOOD' : 'RAW_MATERIAL',
        averageCost: unitCost,
      },
    });
  }
  const oldQty = stock.stock;
  const oldCost = Number(stock.averageCost) || 0;
  const averageCost = oldQty + qty > 0 ? ((oldQty * oldCost) + (qty * unitCost)) / (oldQty + qty) : unitCost;
  const updated = await client.inventoryStock.update({
    where: { id: stock.id },
    data: { stock: { increment: qty }, averageCost },
  });
  await client.inventoryMovement.create({
    data: {
      companyId,
      stockId: stock.id,
      movementNo: documentNo('MOV'),
      movementType: 'PURCHASE_RECEIPT',
      sku,
      itemName: name,
      warehouse,
      quantity: qty,
      balanceAfter: updated.stock,
      uom,
      unitCost,
      referenceType: 'PURCHASE_RECEIPT',
      referenceId: receipt.id,
      referenceNo: receipt.grnNo,
      reason: `Accepted from ${vendorName}`,
      createdBy,
    },
  });
  await syncProductStock(client, companyId, sku);
  return updated;
}

function requestInclude() {
  return {
    quotations: { include: { vendor: true, purchaseOrder: true }, orderBy: { totalAmount: 'asc' } },
    purchaseOrders: { select: { id: true, poNumber: true, status: true } },
  };
}

export const purchaseService = {
  async dashboard(companyId) {
    const [vendors, requests, quotations, orders, receipts, returns, unpaidBills, spend, recentOrders] = await Promise.all([
      prisma.vendor.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.purchaseRequest.count({ where: { companyId, status: { not: 'PO_CREATED' } } }),
      prisma.purchaseQuotation.count({ where: { companyId, status: 'RECEIVED' } }),
      prisma.purchaseOrder.count({ where: { companyId, status: { in: ['ISSUED', 'PARTIALLY_RECEIVED', 'QC_REJECTED'] } } }),
      prisma.purchaseReceipt.count({ where: { companyId } }),
      prisma.purchaseReturn.count({ where: { companyId, status: 'PENDING_DISPATCH' } }),
      prisma.purchaseBill.count({ where: { companyId, status: { in: ['UNPAID', 'PARTIAL'] } } }),
      prisma.purchaseOrder.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
      prisma.purchaseOrder.findMany({ where: { companyId }, include: { vendor: true }, orderBy: { orderDate: 'desc' }, take: 6 }),
    ]);
    return { vendors, requests, quotations, orders, receipts, returns, unpaidBills, totalOrderedValue: Number(spend._sum.totalAmount || 0), recentOrders };
  },

  listVendors(companyId) {
    return prisma.vendor.findMany({
      where: { companyId },
      include: { _count: { select: { quotations: true, purchaseOrders: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  },

  async createVendor(companyId, data) {
    const name = String(data.name || '').trim();
    if (!name) throw purchaseError('Vendor company name is required.');
    const vendorCode = cleanSku(data.vendorCode) || documentNo('VEN');
    return prisma.vendor.create({
      data: {
        companyId,
        vendorCode,
        name,
        contact: String(data.contact || '').trim() || null,
        email: String(data.email || '').trim() || null,
        phone: String(data.phone || '').trim() || null,
        category: String(data.category || 'Raw Materials').trim(),
        taxId: String(data.taxId || '').trim() || null,
        address: String(data.address || '').trim() || null,
        paymentTerms: String(data.paymentTerms || '30 Days').trim(),
        leadTimeDays: nonNegativeInt(data.leadTimeDays ?? 7, 'Lead time'),
        rating: String(data.rating || '5.0 ★').trim(),
        status: 'ACTIVE',
      },
    });
  },

  listRequests(companyId) {
    return prisma.purchaseRequest.findMany({ where: { companyId }, include: requestInclude(), orderBy: { requestDate: 'desc' } });
  },

  async listInventoryShortages(companyId) {
    const [shortages, linkedRequests] = await Promise.all([
      prisma.inventoryProcurementRequest.findMany({
        where: { companyId, status: { in: ['PENDING_PURCHASE', 'PARTIALLY_RECEIVED'] } },
        include: { materialRequest: { select: { requestNo: true, productSku: true, productName: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseRequest.findMany({
        where: { companyId, sourceType: 'INVENTORY_PROCUREMENT' },
        select: { id: true, requestNo: true, sourceRef: true, status: true },
      }),
    ]);
    return shortages.map((shortage) => ({
      ...shortage,
      purchaseRequest: linkedRequests.find((request) => request.sourceRef === shortage.id) || null,
    }));
  },

  async createRequestFromInventoryShortage(companyId, procurementId, actor) {
    const shortage = await prisma.inventoryProcurementRequest.findFirst({
      where: { id: procurementId, companyId },
      include: { materialRequest: true },
    });
    if (!shortage) throw purchaseError('Inventory shortage request not found.', 404);
    const existing = await prisma.purchaseRequest.findFirst({
      where: { companyId, sourceType: 'INVENTORY_PROCUREMENT', sourceRef: shortage.id },
      include: requestInclude(),
    });
    if (existing) return existing;
    const outstanding = shortage.requiredQty - shortage.receivedQty;
    if (outstanding <= 0) throw purchaseError('This inventory shortage is already fulfilled.', 409);
    return prisma.purchaseRequest.create({
      data: {
        companyId,
        requestNo: documentNo('PR'),
        department: 'Production',
        requestedBy: actorName(actor),
        purpose: `Raw material for ${shortage.materialRequest.productName}`,
        items: [{ sku: shortage.sku, name: shortage.itemName, qty: outstanding, uom: shortage.uom, specification: null }],
        sourceType: 'INVENTORY_PROCUREMENT',
        sourceRef: shortage.id,
        status: 'PENDING_QUOTATION',
        notes: `Created from inventory request ${shortage.requestNo}.`,
      },
      include: requestInclude(),
    });
  },

  async createRequest(companyId, data, actor) {
    const items = normalizeRequestItems(data.items);
    return prisma.purchaseRequest.create({
      data: {
        companyId,
        requestNo: documentNo('PR'),
        requiredBy: parseDate(data.requiredBy, 'Required-by date'),
        department: String(data.department || '').trim() || null,
        requestedBy: String(data.requestedBy || actorName(actor) || '').trim() || null,
        purpose: String(data.purpose || '').trim() || null,
        items,
        sourceType: String(data.sourceType || 'MANUAL').trim(),
        sourceRef: String(data.sourceRef || '').trim() || null,
        status: 'PENDING_QUOTATION',
        notes: String(data.notes || '').trim() || null,
      },
      include: requestInclude(),
    });
  },

  listQuotations(companyId) {
    return prisma.purchaseQuotation.findMany({
      where: { companyId },
      include: { vendor: true, request: true, purchaseOrder: true },
      orderBy: [{ requestId: 'asc' }, { totalAmount: 'asc' }],
    });
  },

  async createQuotation(companyId, data) {
    const [request, vendor] = await Promise.all([
      prisma.purchaseRequest.findFirst({ where: { id: String(data.requestId || ''), companyId } }),
      prisma.vendor.findFirst({ where: { id: String(data.vendorId || ''), companyId, status: 'ACTIVE' } }),
    ]);
    if (!request) throw purchaseError('Purchase request not found.', 404);
    if (!vendor) throw purchaseError('Active vendor not found.', 404);
    if (request.status === 'PO_CREATED') throw purchaseError('A purchase order has already been created for this request.', 409);
    const items = normalizeQuoteItems(Array.isArray(request.items) ? request.items : [], data.items);
    const subtotal = Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
    const taxAmount = nonNegativeMoney(data.taxAmount, 'Tax amount');
    const freightAmount = nonNegativeMoney(data.freightAmount, 'Freight amount');
    const quotation = await prisma.purchaseQuotation.create({
      data: {
        companyId,
        requestId: request.id,
        vendorId: vendor.id,
        quoteNo: documentNo('RFQ'),
        vendorQuoteNo: String(data.vendorQuoteNo || '').trim() || null,
        validUntil: parseDate(data.validUntil, 'Quote validity date'),
        items,
        subtotal,
        taxAmount,
        freightAmount,
        totalAmount: subtotal + taxAmount + freightAmount,
        deliveryDays: positiveInt(data.deliveryDays || vendor.leadTimeDays || 7, 'Delivery days'),
        paymentTerms: String(data.paymentTerms || vendor.paymentTerms || '').trim() || null,
        status: 'RECEIVED',
        notes: String(data.notes || '').trim() || null,
      },
      include: { vendor: true, request: true, purchaseOrder: true },
    });
    await prisma.purchaseRequest.update({ where: { id: request.id }, data: { status: 'QUOTATION_RECEIVED' } });
    return quotation;
  },

  async selectQuotation(companyId, quotationId) {
    return prisma.$transaction(async (tx) => {
      const quotation = await tx.purchaseQuotation.findFirst({ where: { id: quotationId, companyId }, include: { request: true, vendor: true } });
      if (!quotation) throw purchaseError('Vendor quotation not found.', 404);
      if (quotation.request.status === 'PO_CREATED') throw purchaseError('A purchase order already exists for this request.', 409);
      await tx.purchaseQuotation.updateMany({ where: { requestId: quotation.requestId }, data: { status: 'NOT_SELECTED' } });
      const selected = await tx.purchaseQuotation.update({ where: { id: quotation.id }, data: { status: 'SELECTED' }, include: { vendor: true, request: true } });
      await tx.purchaseRequest.update({ where: { id: quotation.requestId }, data: { status: 'VENDOR_SELECTED' } });
      return selected;
    });
  },

  listOrders(companyId) {
    return prisma.purchaseOrder.findMany({
      where: { companyId },
      include: { vendor: true, request: true, quotation: true, receipts: true, returns: true, bill: true },
      orderBy: { orderDate: 'desc' },
    });
  },

  async createOrder(companyId, quotationId, data, actor) {
    return prisma.$transaction(async (tx) => {
      const quotation = await tx.purchaseQuotation.findFirst({
        where: { id: quotationId, companyId },
        include: { vendor: true, request: true, purchaseOrder: true },
      });
      if (!quotation) throw purchaseError('Selected quotation not found.', 404);
      if (quotation.purchaseOrder) return quotation.purchaseOrder;
      if (quotation.status !== 'SELECTED') throw purchaseError('Select this vendor quotation before creating the purchase order.', 409);
      const expectedDate = data.expectedDate
        ? parseDate(data.expectedDate, 'Expected delivery date')
        : new Date(Date.now() + quotation.deliveryDays * 86400000);
      const order = await tx.purchaseOrder.create({
        data: {
          companyId,
          requestId: quotation.requestId,
          quotationId: quotation.id,
          vendorId: quotation.vendorId,
          poNumber: documentNo('PO'),
          expectedDate,
          items: quotation.items,
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          freightAmount: quotation.freightAmount,
          totalAmount: quotation.totalAmount,
          deliveryAddress: String(data.deliveryAddress || '').trim() || null,
          paymentTerms: String(data.paymentTerms || quotation.paymentTerms || '').trim() || null,
          terms: String(data.terms || '').trim() || null,
          status: 'ISSUED',
          issuedBy: actorName(actor),
        },
        include: { vendor: true, request: true, quotation: true, receipts: true, returns: true, bill: true },
      });
      await tx.purchaseRequest.update({ where: { id: quotation.requestId }, data: { status: 'PO_CREATED' } });
      return order;
    });
  },

  listWarehouses(companyId) {
    return prisma.inventoryWarehouse.findMany({ where: { companyId, status: 'ACTIVE' }, include: { bins: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  },

  listReceipts(companyId) {
    return prisma.purchaseReceipt.findMany({
      where: { companyId },
      include: { order: { include: { vendor: true } }, returns: true },
      orderBy: { receivedAt: 'desc' },
    });
  },

  async createReceipt(companyId, orderId, data, actor) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, companyId },
        include: { vendor: true, receipts: true, request: true },
      });
      if (!order) throw purchaseError('Purchase order not found.', 404);
      if (['CANCELLED', 'CLOSED'].includes(order.status)) throw purchaseError('This purchase order cannot receive more material.', 409);
      const orderedItems = Array.isArray(order.items) ? order.items : [];
      if (!Array.isArray(data.items) || data.items.length === 0) throw purchaseError('Add at least one received material.');
      const previousAccepted = new Map();
      for (const oldReceipt of order.receipts) {
        for (const line of Array.isArray(oldReceipt.items) ? oldReceipt.items : []) {
          previousAccepted.set(line.sku, (previousAccepted.get(line.sku) || 0) + Number(line.acceptedQty || 0));
        }
      }
      const items = data.items.map((line, index) => {
        const sku = cleanSku(line.sku);
        const ordered = orderedItems.find((item) => item.sku === sku);
        if (!ordered) throw purchaseError(`Received material ${sku || index + 1} is not on this purchase order.`);
        const receivedQty = positiveInt(line.receivedQty, `Received quantity for ${sku}`);
        const acceptedQty = nonNegativeInt(line.acceptedQty, `Accepted quantity for ${sku}`);
        const rejectedQty = nonNegativeInt(line.rejectedQty, `Rejected quantity for ${sku}`);
        if (acceptedQty + rejectedQty !== receivedQty) throw purchaseError(`Accepted plus rejected quantity must equal received quantity for ${sku}.`);
        const acceptedOutstanding = Number(ordered.qty) - (previousAccepted.get(sku) || 0);
        if (acceptedQty > acceptedOutstanding) throw purchaseError(`Only ${acceptedOutstanding} ${ordered.uom} of ${sku} remain outstanding.`);
        return {
          sku,
          name: ordered.name,
          uom: ordered.uom || 'PCS',
          orderedQty: Number(ordered.qty),
          receivedQty,
          acceptedQty,
          rejectedQty,
          unitCost: Number(ordered.unitRate || 0),
          rejectionReason: rejectedQty > 0 ? String(line.rejectionReason || 'Quality inspection failed').trim() : null,
        };
      });
      const receivedQty = items.reduce((sum, line) => sum + line.receivedQty, 0);
      const acceptedQty = items.reduce((sum, line) => sum + line.acceptedQty, 0);
      const rejectedQty = items.reduce((sum, line) => sum + line.rejectedQty, 0);
      const warehouse = String(data.warehouse || 'Main Warehouse').trim();
      const receipt = await tx.purchaseReceipt.create({
        data: {
          companyId,
          orderId: order.id,
          grnNo: documentNo('GRN'),
          warehouse,
          items,
          receivedQty,
          acceptedQty,
          rejectedQty,
          qcStatus: rejectedQty === 0 ? 'PASSED' : acceptedQty === 0 ? 'REJECTED' : 'PARTIAL',
          receivedBy: actorName(actor),
          notes: String(data.notes || '').trim() || null,
        },
      });
      for (const line of items.filter((item) => item.acceptedQty > 0)) {
        await receiveWarehouseStock(tx, {
          companyId,
          sku: line.sku,
          name: line.name,
          qty: line.acceptedQty,
          uom: line.uom,
          warehouse,
          unitCost: line.unitCost,
          receipt,
          vendorName: order.vendor.name,
          createdBy: actorName(actor),
        });
      }
      if (order.request.sourceType === 'INVENTORY_PROCUREMENT' && order.request.sourceRef) {
        const procurement = await tx.inventoryProcurementRequest.findFirst({
          where: { id: order.request.sourceRef, companyId },
        });
        if (procurement) {
          const acceptedForShortage = items
            .filter((line) => line.sku === procurement.sku)
            .reduce((sum, line) => sum + line.acceptedQty, 0);
          if (acceptedForShortage > 0) {
            const totalReceived = Math.min(procurement.requiredQty, procurement.receivedQty + acceptedForShortage);
            await tx.inventoryProcurementRequest.update({
              where: { id: procurement.id },
              data: {
                receivedQty: totalReceived,
                vendorName: order.vendor.name,
                unitCost: items.find((line) => line.sku === procurement.sku)?.unitCost || procurement.unitCost,
                status: totalReceived >= procurement.requiredQty ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
                receivedAt: totalReceived >= procurement.requiredQty ? new Date() : null,
              },
            });
            const siblingShortages = await tx.inventoryProcurementRequest.findMany({
              where: { materialRequestId: procurement.materialRequestId },
            });
            const ready = siblingShortages.every((line) => line.receivedQty >= line.requiredQty);
            await tx.inventoryMaterialRequest.update({
              where: { id: procurement.materialRequestId },
              data: { status: ready ? 'READY_FOR_ISSUE' : 'WAITING_PURCHASE' },
            });
          }
        }
      }
      let purchaseReturn = null;
      if (rejectedQty > 0) {
        const returnItems = items.filter((line) => line.rejectedQty > 0).map((line) => ({
          sku: line.sku,
          name: line.name,
          qty: line.rejectedQty,
          uom: line.uom,
          reason: line.rejectionReason,
        }));
        purchaseReturn = await tx.purchaseReturn.create({
          data: {
            companyId,
            orderId: order.id,
            receiptId: receipt.id,
            returnNo: documentNo('RTV'),
            items: returnItems,
            totalQty: rejectedQty,
            reason: 'Rejected during GRN quality inspection',
            status: 'PENDING_DISPATCH',
          },
        });
      }
      const allReceipts = await tx.purchaseReceipt.findMany({ where: { orderId: order.id } });
      const acceptedBySku = new Map();
      for (const currentReceipt of allReceipts) {
        for (const line of Array.isArray(currentReceipt.items) ? currentReceipt.items : []) {
          acceptedBySku.set(line.sku, (acceptedBySku.get(line.sku) || 0) + Number(line.acceptedQty || 0));
        }
      }
      const fullyReceived = orderedItems.every((line) => (acceptedBySku.get(line.sku) || 0) >= Number(line.qty));
      const orderStatus = fullyReceived ? 'RECEIVED' : acceptedQty === 0 && rejectedQty > 0 ? 'QC_REJECTED' : 'PARTIALLY_RECEIVED';
      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: orderStatus, closedAt: fullyReceived ? new Date() : null } });
      return { receipt, purchaseReturn, orderStatus };
    });
  },

  listReturns(companyId) {
    return prisma.purchaseReturn.findMany({
      where: { companyId },
      include: { order: { include: { vendor: true } }, receipt: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async dispatchReturn(companyId, returnId, data) {
    const purchaseReturn = await prisma.purchaseReturn.findFirst({ where: { id: returnId, companyId } });
    if (!purchaseReturn) throw purchaseError('Purchase return not found.', 404);
    if (purchaseReturn.status === 'RETURNED') return purchaseReturn;
    return prisma.purchaseReturn.update({
      where: { id: purchaseReturn.id },
      data: {
        status: 'RETURNED',
        dispatchedAt: new Date(),
        creditNoteNo: String(data.creditNoteNo || '').trim() || null,
        notes: String(data.notes || purchaseReturn.notes || '').trim() || null,
      },
      include: { order: { include: { vendor: true } }, receipt: true },
    });
  },

  listBills(companyId) {
    return prisma.purchaseBill.findMany({ where: { companyId }, include: { order: { include: { vendor: true } } }, orderBy: { invoiceDate: 'desc' } });
  },

  async createBill(companyId, orderId, data) {
    const order = await prisma.purchaseOrder.findFirst({ where: { id: orderId, companyId }, include: { receipts: true, bill: true } });
    if (!order) throw purchaseError('Purchase order not found.', 404);
    if (order.bill) throw purchaseError('A bill already exists for this purchase order.', 409);
    if (!order.receipts.some((receipt) => receipt.acceptedQty > 0)) throw purchaseError('Record an accepted goods receipt before creating the purchase bill.', 409);
    const vendorInvoiceNo = String(data.vendorInvoiceNo || '').trim();
    if (!vendorInvoiceNo) throw purchaseError('Vendor invoice number is required.');
    const taxableAmount = nonNegativeMoney(data.taxableAmount ?? order.subtotal, 'Taxable amount');
    const taxAmount = nonNegativeMoney(data.taxAmount ?? order.taxAmount, 'Tax amount');
    const otherCharges = nonNegativeMoney(data.otherCharges ?? order.freightAmount, 'Other charges');
    return prisma.purchaseBill.create({
      data: {
        companyId,
        orderId: order.id,
        billNo: documentNo('BILL'),
        vendorInvoiceNo,
        invoiceDate: parseDate(data.invoiceDate, 'Invoice date') || new Date(),
        dueDate: parseDate(data.dueDate, 'Due date'),
        taxableAmount,
        taxAmount,
        otherCharges,
        totalAmount: taxableAmount + taxAmount + otherCharges,
        status: 'UNPAID',
        notes: String(data.notes || '').trim() || null,
      },
      include: { order: { include: { vendor: true } } },
    });
  },

  async markBillPaid(companyId, billId, data) {
    const bill = await prisma.purchaseBill.findFirst({ where: { id: billId, companyId } });
    if (!bill) throw purchaseError('Purchase bill not found.', 404);
    return prisma.purchaseBill.update({
      where: { id: bill.id },
      data: { status: 'PAID', paymentReference: String(data.paymentReference || '').trim() || null, paidAt: new Date() },
      include: { order: { include: { vendor: true } } },
    });
  },
};

export default purchaseService;
