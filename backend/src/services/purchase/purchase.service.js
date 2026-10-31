import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.js';
import approvalService from '../approval.service.js';
import versionService from '../version.service.js';
import notificationService from '../notification.service.js';
import auditService from '../audit.service.js';

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
  return actor?.email || actor?.name || actor?.role || 'SYSTEM';
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
  let location = await client.inventoryWarehouse.findFirst({ where: { companyId, name: warehouse } });
  if (!location) {
    location = await client.inventoryWarehouse.create({
      data: {
        companyId,
        code: cleanSku(warehouse) || 'MAIN-WH',
        name: warehouse,
        status: 'ACTIVE',
        isDefault: true,
      },
    });
  }
  let stock = await client.inventoryStock.findFirst({ where: { companyId, sku, warehouse: location.name } });
  if (!stock) {
    stock = await client.inventoryStock.create({
      data: {
        companyId,
        sku,
        name,
        warehouse: location.name,
        uom: uom || 'PCS',
        stock: 0,
        averageCost: unitCost || 0,
      },
    });
  }
  const beforeStock = stock.stock;
  const afterStock = beforeStock + qty;
  const currentCost = Number(stock.averageCost || 0);
  const weightedCost = afterStock > 0 ? Number((((beforeStock * currentCost) + (qty * unitCost)) / afterStock).toFixed(2)) : unitCost;
  const newAvailable = (stock.availableQty || 0) + qty;

  await client.inventoryStock.update({
    where: { id: stock.id },
    data: { stock: afterStock, availableQty: newAvailable, averageCost: weightedCost },
  });

  const batchNo = `BATCH-${receipt.grnNo}-${cleanSku(sku)}`;
  let batch = await client.inventoryBatch.findFirst({
    where: { companyId, sku, batchNo, warehouse: location.name },
  });

  if (!batch) {
    batch = await client.inventoryBatch.create({
      data: {
        companyId,
        stockId: stock.id,
        sku,
        batchNo,
        warehouse: location.name,
        initialQty: qty,
        availableQty: qty,
        grnId: receipt.id,
        grnNo: receipt.grnNo,
        vendorName,
        receivedDate: receipt.receivedAt || new Date(),
        qualityStatus: 'ACCEPTED',
        status: 'ACTIVE',
        unitCost: unitCost || 0,
      },
    });
  } else {
    batch = await client.inventoryBatch.update({
      where: { id: batch.id },
      data: {
        availableQty: batch.availableQty + qty,
        initialQty: batch.initialQty + qty,
      },
    });
  }

  await client.inventoryMovement.create({
    data: {
      companyId,
      movementNo: documentNo('MOV'),
      stockId: stock.id,
      batchId: batch.id,
      batchNo: batch.batchNo,
      sku,
      itemName: name,
      warehouse: location.name,
      quantity: qty,
      balanceAfter: afterStock,
      sourceBucket: null,
      destinationBucket: 'AVAILABLE',
      uom: uom || 'PCS',
      unitCost: unitCost || 0,
      movementType: 'INWARD',
      referenceType: 'PURCHASE_RECEIPT',
      referenceId: receipt.id,
      referenceNo: receipt.grnNo,
      notes: `Accepted inward from ${vendorName}. Reason: Goods receipt note ${receipt.grnNo}`,
      createdBy: createdBy || 'Purchase System',
    },
  });
  await syncProductStock(client, companyId, sku);
}

function requestInclude() {
  return {
    quotations: { include: { vendor: true, purchaseOrder: true } },
    purchaseOrders: { select: { id: true, poNumber: true, status: true } },
  };
}

export const purchaseService = {
  async dashboard(companyId) {
    const [vendors, requests, quotations, orders, receipts, returns, unpaidBills, spend, recentOrders, deviations, artworkCount] = await Promise.all([
      prisma.vendor.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.purchaseRequest.count({ where: { companyId, status: { not: 'PO_CREATED' } } }),
      prisma.purchaseQuotation.count({ where: { companyId, status: 'RECEIVED' } }),
      prisma.purchaseOrder.count({ where: { companyId, status: { in: ['ISSUED', 'PARTIALLY_RECEIVED', 'QC_REJECTED'] } } }),
      prisma.purchaseReceipt.count({ where: { companyId } }),
      prisma.purchaseReturn.count({ where: { companyId, status: 'PENDING_DISPATCH' } }),
      prisma.purchaseBill.count({ where: { companyId, status: { in: ['UNPAID', 'PAYMENT_HOLD'] } } }),
      prisma.purchaseOrder.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
      prisma.purchaseOrder.findMany({ where: { companyId }, include: { vendor: true }, orderBy: { orderDate: 'desc' }, take: 6 }),
      prisma.purchaseDeviation.count({ where: { companyId, resolutionStatus: 'OPEN' } }),
      prisma.purchaseArtworkProof.count({ where: { companyId, designStatus: 'PENDING_REVIEW' } }),
    ]);
    return {
      vendors,
      requests,
      quotations,
      orders,
      receipts,
      returns,
      unpaidBills,
      totalOrderedValue: Number(spend._sum.totalAmount || 0),
      recentOrders,
      openDeviations: deviations,
      pendingArtworkReviews: artworkCount,
    };
  },

  // ====================================================================
  // 1. VENDOR MASTER & ONBOARDING
  // ====================================================================
  listVendors(companyId) {
    return prisma.vendor.findMany({
      where: { companyId },
      include: {
        _count: { select: { quotations: true, purchaseOrders: true, artworkProofs: true, deviations: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  },

  async getVendor(companyId, vendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
      include: {
        quotations: { take: 5, orderBy: { createdAt: 'desc' } },
        purchaseOrders: { take: 5, orderBy: { orderDate: 'desc' } },
        artworkProofs: { take: 5, orderBy: { createdAt: 'desc' } },
        deviations: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!vendor) throw purchaseError('Vendor not found.', 404);
    return vendor;
  },

  async createVendor(companyId, data, actor) {
    const name = String(data.name || '').trim();
    if (!name) throw purchaseError('Vendor company name is required.');
    const vendorCode = cleanSku(data.vendorCode) || documentNo('VEN');

    const vendor = await prisma.vendor.create({
      data: {
        companyId,
        vendorCode,
        name,
        legalName: String(data.legalName || name).trim(),
        contact: String(data.contact || '').trim() || null,
        email: String(data.email || '').trim() || null,
        phone: String(data.phone || '').trim() || null,
        mobile: String(data.mobile || data.phone || '').trim() || null,
        category: String(data.category || 'Raw Materials').trim(),
        taxId: String(data.taxId || data.gstin || '').trim() || null,
        pan: String(data.pan || '').trim().toUpperCase() || null,
        address: String(data.address || '').trim() || null,
        registeredAddress: String(data.registeredAddress || data.address || '').trim() || null,
        billingAddress: String(data.billingAddress || data.address || '').trim() || null,
        state: String(data.state || '').trim() || null,
        city: String(data.city || '').trim() || null,
        pincode: String(data.pincode || '').trim() || null,
        contactPersons: Array.isArray(data.contactPersons) ? data.contactPersons : null,
        paymentTerms: String(data.paymentTerms || '30 Days').trim(),
        creditPeriodDays: nonNegativeInt(data.creditPeriodDays ?? 30, 'Credit period'),
        leadTimeDays: nonNegativeInt(data.leadTimeDays ?? 7, 'Lead time'),
        bankDetails: data.bankDetails && typeof data.bankDetails === 'object' ? data.bankDetails : null,
        productCategories: Array.isArray(data.productCategories) ? data.productCategories : null,
        rating: String(data.rating || '5.0 ★').trim(),
        status: (data.requiresApproval !== false && data.approvalStatus !== 'APPROVED') ? 'INACTIVE' : (data.status || 'ACTIVE'),
        approvalStatus: (data.requiresApproval !== false && data.approvalStatus !== 'APPROVED') ? 'PENDING_APPROVAL' : 'APPROVED',
        approvedById: (data.requiresApproval !== false && data.approvalStatus !== 'APPROVED') ? null : (actor?.id || 'SYSTEM'),
        approvedByName: (data.requiresApproval !== false && data.approvalStatus !== 'APPROVED') ? null : actorName(actor),
        approvedAt: (data.requiresApproval !== false && data.approvalStatus !== 'APPROVED') ? null : new Date(),
      },
    });

    if (vendor.approvalStatus === 'PENDING_APPROVAL') {
      await approvalService.createRequest({
        companyId,
        entityType: 'VENDOR',
        entityId: vendor.id,
        creatorId: actor?.id || 'SYSTEM',
        creatorName: actorName(actor),
        title: `Vendor Onboarding Approval: ${vendor.name}`,
        description: `Review registration, GSTIN (${vendor.taxId || 'N/A'}), and bank mandate for vendor ${vendor.name}.`,
      }).catch(() => {});
    }

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_VENDOR',
      entityType: 'VENDOR',
      entityId: vendor.id,
      details: `Registered vendor ${vendor.name} (${vendor.vendorCode}).`,
      afterState: { name: vendor.name, code: vendor.vendorCode, taxId: vendor.taxId },
    });

    return vendor;
  },

  async approveVendor(companyId, vendorId, actor) {
    const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, companyId } });
    if (!vendor) throw purchaseError('Vendor not found.', 404);

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        approvalStatus: 'APPROVED',
        status: 'ACTIVE',
        approvedById: actor?.id || 'SYSTEM',
        approvedByName: actorName(actor),
        approvedAt: new Date(),
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'APPROVE_VENDOR',
      entityType: 'VENDOR',
      entityId: vendor.id,
      details: `Approved vendor ${vendor.name} for procurement activities.`,
    });

    return updated;
  },

  // ====================================================================
  // 2. PURCHASE REQUEST / INDENT WORKFLOW
  // ====================================================================
  listRequests(companyId) {
    return prisma.purchaseRequest.findMany({
      where: { companyId },
      include: requestInclude(),
      orderBy: { requestDate: 'desc' },
    });
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
    const pr = await prisma.purchaseRequest.create({
      data: {
        companyId,
        requestNo: documentNo('PR'),
        department: 'Production',
        requestedBy: actorName(actor),
        purpose: `Raw material for ${shortage.materialRequest.productName}`,
        items: [{ sku: shortage.sku, name: shortage.itemName, qty: outstanding, uom: shortage.uom, specification: null }],
        sourceType: 'INVENTORY_PROCUREMENT',
        sourceRef: shortage.id,
        status: 'PENDING_APPROVAL',
        priority: 'HIGH',
        notes: `Created from inventory request ${shortage.requestNo}.`,
      },
      include: requestInclude(),
    });

    await versionService.createInitialVersion({
      companyId,
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      creatorId: actor?.id || 'SYSTEM',
      creatorName: actorName(actor),
      snapshotData: pr,
    }).catch(() => {});

    return pr;
  },

  async createRequest(companyId, data, actor) {
    const items = normalizeRequestItems(data.items);
    const requestNo = data.requestNo?.trim() || documentNo('PR');
    const priority = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(data.priority) ? data.priority : 'MEDIUM';

    const pr = await prisma.purchaseRequest.create({
      data: {
        companyId,
        requestNo,
        requiredBy: parseDate(data.requiredBy, 'Required-by date'),
        department: String(data.department || 'Procurement').trim() || null,
        requestedBy: String(data.requestedBy || actorName(actor) || '').trim() || null,
        purpose: String(data.purpose || '').trim() || null,
        items,
        sourceType: String(data.sourceType || 'MANUAL').trim(),
        sourceRef: String(data.sourceRef || '').trim() || null,
        status: 'PENDING_APPROVAL',
        priority,
        notes: String(data.notes || '').trim() || null,
        versionNumber: 1,
      },
      include: requestInclude(),
    });

    // Create Phase 1 immutable V1 snapshot
    await versionService.createInitialVersion({
      companyId,
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      creatorId: actor?.id || 'SYSTEM',
      creatorName: actorName(actor),
      snapshotData: pr,
    }).catch(() => {});

    // Create Phase 1 Approval Request
    await approvalService.createRequest({
      companyId,
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      creatorId: actor?.id || 'SYSTEM',
      creatorName: actorName(actor),
      title: `Purchase Request Approval: ${pr.requestNo}`,
      description: `Indent for ${items.length} material(s) by ${pr.requestedBy} (${pr.department || 'General'}).`,
    }).catch(() => {});

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_PURCHASE_REQUEST',
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      details: `Created Purchase Request ${pr.requestNo} with ${items.length} items.`,
    });

    return pr;
  },

  async approveRequest(companyId, requestId, actor) {
    const pr = await prisma.purchaseRequest.findFirst({ where: { id: requestId, companyId } });
    if (!pr) throw purchaseError('Purchase request not found.', 404);

    const updated = await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: {
        status: 'APPROVED',
        approvedById: actor?.id || 'SYSTEM',
        approvedByName: actorName(actor),
        approvedAt: new Date(),
        isLocked: true,
      },
      include: requestInclude(),
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'APPROVE_PURCHASE_REQUEST',
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      details: `Approved Purchase Request ${pr.requestNo} for sourcing.`,
    });

    return updated;
  },

  async rejectRequest(companyId, requestId, reason, actor) {
    const pr = await prisma.purchaseRequest.findFirst({ where: { id: requestId, companyId } });
    if (!pr) throw purchaseError('Purchase request not found.', 404);
    if (!reason?.trim()) throw purchaseError('Rejection reason is required.');

    const updated = await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        isLocked: true,
      },
      include: requestInclude(),
    });

    await notificationService.createNotification({
      companyId,
      recipientId: pr.requestedBy || 'ALL',
      category: 'ALERT',
      title: `Purchase Request Rejected: ${pr.requestNo}`,
      message: `Reason: ${reason}`,
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
    }).catch(() => {});

    await auditService.logAction({
      companyId,
      actor,
      action: 'REJECT_PURCHASE_REQUEST',
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      details: `Rejected Purchase Request ${pr.requestNo}. Reason: ${reason}`,
    });

    return updated;
  },

  async reviseRequest(companyId, requestId, data, actor) {
    const pr = await prisma.purchaseRequest.findFirst({ where: { id: requestId, companyId } });
    if (!pr) throw purchaseError('Purchase request not found.', 404);
    const revisionReason = String(data.revisionReason || data.reason || '').trim();
    if (!revisionReason) throw purchaseError('Revision reason is required to branch a new version.');

    const newVersionNumber = (pr.versionNumber || 1) + 1;
    const items = data.items ? normalizeRequestItems(data.items) : pr.items;

    const updated = await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: {
        items,
        priority: data.priority || pr.priority,
        notes: data.notes || pr.notes,
        versionNumber: newVersionNumber,
        status: 'PENDING_APPROVAL',
        isLocked: false,
      },
      include: requestInclude(),
    });

    await versionService.branchNewVersion({
      companyId,
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      creatorId: actor?.id || 'SYSTEM',
      creatorName: actorName(actor),
      revisionReason,
      snapshotData: updated,
    }).catch(() => {});

    return updated;
  },

  // ====================================================================
  // 3. RFQ & LANDED COST CALCULATION (Target 5, Min 2, Landed Cost Formula)
  // ====================================================================
  listQuotations(companyId, requestId = null) {
    const where = { companyId };
    if (requestId) where.requestId = requestId;
    return prisma.purchaseQuotation.findMany({
      where,
      include: { vendor: true, request: true, purchaseOrder: true },
      orderBy: [{ requestId: 'asc' }, { landedCost: 'asc' }],
    });
  },

  async createQuotation(companyId, data, actor) {
    const [request, vendor] = await Promise.all([
      prisma.purchaseRequest.findFirst({ where: { id: String(data.requestId || ''), companyId } }),
      prisma.vendor.findFirst({ where: { id: String(data.vendorId || ''), companyId, status: 'ACTIVE' } }),
    ]);
    if (!request) throw purchaseError('Purchase request not found.', 404);
    if (!vendor) throw purchaseError('Active vendor not found.', 404);
    if (request.status === 'REJECTED') {
      throw purchaseError('Cannot submit quotation for a rejected purchase request.', 409);
    }
    if (request.status === 'PO_CREATED') {
      throw purchaseError('A purchase order has already been created for this request.', 409);
    }

    const items = normalizeQuoteItems(Array.isArray(request.items) ? request.items : [], data.items);
    const subtotal = Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
    const taxAmount = nonNegativeMoney(data.taxAmount, 'Tax amount');
    const freightAmount = nonNegativeMoney(data.freightAmount, 'Freight amount');
    const loadingCharges = nonNegativeMoney(data.loadingCharges, 'Loading charges');
    const unloadingCharges = nonNegativeMoney(data.unloadingCharges, 'Unloading charges');
    const handlingCharges = nonNegativeMoney(data.handlingCharges, 'Handling charges');
    const otherCharges = nonNegativeMoney(data.otherCharges, 'Other charges');

    // Landed Cost Formula: Basic Amount + Tax + Freight + Loading + Unloading + Handling + Other charges
    const landedCost = Number((subtotal + taxAmount + freightAmount + loadingCharges + unloadingCharges + handlingCharges + otherCharges).toFixed(2));
    const transporterResponsibility = ['SUPPLIER', 'BUYER', 'THIRD_PARTY'].includes(data.transporterResponsibility)
      ? data.transporterResponsibility
      : 'SUPPLIER';

    const quotation = await prisma.purchaseQuotation.create({
      data: {
        companyId,
        requestId: request.id,
        vendorId: vendor.id,
        quoteNo: data.quoteNo?.trim() || documentNo('RFQ'),
        vendorQuoteNo: String(data.vendorQuoteNo || '').trim() || null,
        validUntil: parseDate(data.validUntil, 'Quote validity date'),
        items,
        subtotal,
        taxAmount,
        freightAmount,
        loadingCharges,
        unloadingCharges,
        handlingCharges,
        otherCharges,
        landedCost,
        totalAmount: landedCost,
        deliveryDays: positiveInt(data.deliveryDays || vendor.leadTimeDays || 7, 'Delivery days'),
        paymentTerms: String(data.paymentTerms || vendor.paymentTerms || '').trim() || null,
        transporterResponsibility,
        status: 'RECEIVED',
        notes: String(data.notes || '').trim() || null,
      },
      include: { vendor: true, request: true, purchaseOrder: true },
    });

    // Update isLowestLandedCost flag across all quotations for this request
    const allQuotes = await prisma.purchaseQuotation.findMany({
      where: { companyId, requestId: request.id },
      orderBy: { landedCost: 'asc' },
    });

    if (allQuotes.length > 0) {
      const minCost = Number(allQuotes[0].landedCost);
      for (const q of allQuotes) {
        await prisma.purchaseQuotation.update({
          where: { id: q.id },
          data: { isLowestLandedCost: Number(q.landedCost) === minCost },
        });
      }
    }

    await prisma.purchaseRequest.update({ where: { id: request.id }, data: { status: 'QUOTATION_RECEIVED' } });
    return quotation;
  },

  async compareQuotations(companyId, requestId) {
    const request = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, companyId },
      include: {
        quotations: {
          include: { vendor: true },
          orderBy: { landedCost: 'asc' },
        },
      },
    });
    if (!request) throw purchaseError('Purchase request not found.', 404);

    const quotations = request.quotations || [];
    const minLandedCost = quotations.length > 0 ? Math.min(...quotations.map(q => Number(q.landedCost))) : 0;

    return {
      request,
      quotationCount: quotations.length,
      targetQuotations: 5,
      isTargetMet: quotations.length >= 5,
      minimumRequired: 2,
      isMinimumMet: quotations.length >= 2,
      hasExceptionApproval: quotations.some(q => q.isExceptionApproved),
      lowestLandedCost: minLandedCost,
      comparisonMatrix: quotations.map(q => ({
        id: q.id,
        quoteNo: q.quoteNo,
        vendorId: q.vendorId,
        vendorName: q.vendor.name,
        basicRate: Number(q.subtotal),
        gst: Number(q.taxAmount),
        freight: Number(q.freightAmount),
        loading: Number(q.loadingCharges),
        unloading: Number(q.unloadingCharges),
        handling: Number(q.handlingCharges),
        other: Number(q.otherCharges),
        totalLandedCost: Number(q.landedCost),
        deliveryDays: q.deliveryDays,
        paymentTerms: q.paymentTerms,
        transporterResponsibility: q.transporterResponsibility,
        isLowest: Number(q.landedCost) === minLandedCost,
        status: q.status,
      })),
    };
  },

  async requestQuoteException(companyId, requestId, { reason }, actor) {
    if (!reason?.trim()) throw purchaseError('Written justification is required for quotation exception.');
    const quotes = await prisma.purchaseQuotation.findMany({ where: { companyId, requestId } });
    if (quotes.length === 0) throw purchaseError('At least one quotation must exist to request an exception.');

    await prisma.purchaseQuotation.updateMany({
      where: { companyId, requestId },
      data: {
        isExceptionApproved: true,
        exceptionReason: reason.trim(),
        exceptionApprovedById: actor?.id || 'MANAGER',
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'APPROVE_QUOTATION_EXCEPTION',
      entityType: 'PURCHASE_REQUEST',
      entityId: requestId,
      details: `Manager exception approved for PR with fewer than 2 quotations. Justification: ${reason}`,
    });

    return { success: true, message: 'Exception approved.' };
  },

  async selectQuotation(companyId, quotationId, options = {}, actor) {
    return prisma.$transaction(async (tx) => {
      const quotation = await tx.purchaseQuotation.findFirst({
        where: { id: quotationId, companyId },
        include: { request: true, vendor: true },
      });
      if (!quotation) throw purchaseError('Vendor quotation not found.', 404);
      if (quotation.request.status === 'PO_CREATED') throw purchaseError('A purchase order already exists for this request.', 409);

      // Rule: Minimum 2 comparable quotations per item before PO creation
      // Unless authorized Manager exception approval exists
      const allQuotesForRequest = await tx.purchaseQuotation.findMany({
        where: { companyId, requestId: quotation.requestId },
      });

      const hasException = allQuotesForRequest.some(q => q.isExceptionApproved);
      if (allQuotesForRequest.length < 2 && !hasException) {
        throw purchaseError(
          `Minimum 2 comparable quotations required before selection (currently ${allQuotesForRequest.length}). Manager exception approval is required to proceed.`,
          400
        );
      }

      // Rule: Non-lowest vendor selection requires written justification and approval
      const minLandedCost = Math.min(...allQuotesForRequest.map(q => Number(q.landedCost)));
      const isLowest = Number(quotation.landedCost) === minLandedCost;

      const justification = String(options.justification || options.nonLowestJustification || '').trim();
      if (!isLowest && !justification) {
        throw purchaseError(
          `Selected vendor has a landed cost (₹${quotation.landedCost}) higher than the lowest quote (₹${minLandedCost}). Written justification is mandatory to select a non-lowest vendor.`,
          400
        );
      }

      await tx.purchaseQuotation.updateMany({
        where: { requestId: quotation.requestId },
        data: { status: 'NOT_SELECTED' },
      });

      const selected = await tx.purchaseQuotation.update({
        where: { id: quotation.id },
        data: {
          status: 'SELECTED',
          nonLowestJustification: isLowest ? null : justification,
        },
        include: { vendor: true, request: true },
      });

      await tx.purchaseRequest.update({
        where: { id: quotation.requestId },
        data: { status: 'VENDOR_SELECTED' },
      });

      return selected;
    });
  },

  // ====================================================================
  // 4. PURCHASE ORDER MANAGEMENT & APPROVAL WORKFLOW
  // ====================================================================
  listOrders(companyId) {
    return prisma.purchaseOrder.findMany({
      where: { companyId },
      include: {
        vendor: true,
        request: true,
        quotation: true,
        receipts: true,
        returns: true,
        bill: true,
        artworkProofs: true,
        deviations: true,
      },
      orderBy: { orderDate: 'desc' },
    });
  },

  async getOrder(companyId, orderId) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        vendor: true,
        request: true,
        quotation: true,
        receipts: { include: { returns: true, deviations: true } },
        returns: true,
        bill: true,
        artworkProofs: true,
        deviations: true,
      },
    });
    if (!order) throw purchaseError('Purchase order not found.', 404);

    // Calculate order balances
    const orderedItems = Array.isArray(order.items) ? order.items : [];
    const receivedBySku = new Map();
    for (const r of order.receipts || []) {
      for (const item of Array.isArray(r.items) ? r.items : []) {
        receivedBySku.set(item.sku, (receivedBySku.get(item.sku) || 0) + Number(item.receivedQty || 0));
      }
    }

    const itemsWithBalance = orderedItems.map(item => {
      const received = receivedBySku.get(item.sku) || 0;
      const balance = Math.max(0, Number(item.qty) - received);
      return {
        ...item,
        receivedQty: received,
        orderBalance: balance,
      };
    });

    return {
      ...order,
      itemsWithBalance,
    };
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
          poNumber: data.poNumber?.trim() || documentNo('PO'),
          expectedDate,
          items: quotation.items,
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          freightAmount: quotation.freightAmount,
          loadingUnloadingCharges: Number(quotation.loadingCharges) + Number(quotation.unloadingCharges),
          handlingCharges: quotation.handlingCharges,
          totalAmount: quotation.landedCost || quotation.totalAmount,
          deliveryAddress: String(data.deliveryAddress || '').trim() || null,
          transporterResponsibility: quotation.transporterResponsibility || 'SUPPLIER',
          paymentTerms: String(data.paymentTerms || quotation.paymentTerms || '').trim() || null,
          terms: String(data.terms || '').trim() || null,
          specialInstructions: String(data.specialInstructions || '').trim() || null,
          nonLowestJustification: quotation.nonLowestJustification,
          status: 'ISSUED',
          issuedBy: actorName(actor),
          versionNumber: 1,
          isLocked: false,
        },
        include: { vendor: true, request: true, quotation: true, receipts: true, returns: true, bill: true },
      });

      await tx.purchaseRequest.update({ where: { id: quotation.requestId }, data: { status: 'PO_CREATED' } });

      // Create Phase 1 immutable V1 snapshot
      await versionService.createInitialVersion({
        companyId,
        entityType: 'PURCHASE_ORDER',
        entityId: order.id,
        creatorId: actor?.id || 'SYSTEM',
        creatorName: actorName(actor),
        snapshotData: order,
      }).catch(() => {});

      return order;
    });
  },

  async submitOrderApproval(companyId, orderId, actor) {
    const order = await prisma.purchaseOrder.findFirst({ where: { id: orderId, companyId }, include: { vendor: true } });
    if (!order) throw purchaseError('Purchase order not found.', 404);

    const approvalReq = await approvalService.createRequest({
      companyId,
      entityType: 'PURCHASE_ORDER',
      entityId: order.id,
      creatorId: actor?.id || 'SYSTEM',
      creatorName: actorName(actor),
      title: `Purchase Order Approval: ${order.poNumber}`,
      description: `Approval for PO ${order.poNumber} to ${order.vendor.name} for ?${order.totalAmount}.`,
    });

    return approvalReq;
  },

  async approveOrder(companyId, orderId, actor) {
    const order = await prisma.purchaseOrder.findFirst({ where: { id: orderId, companyId } });
    if (!order) throw purchaseError('Purchase order not found.', 404);

    const updated = await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: 'ISSUED',
        isLocked: true,
        approvedById: actor?.id || 'SYSTEM',
        approvedByName: actorName(actor),
        approvedAt: new Date(),
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'APPROVE_PURCHASE_ORDER',
      entityType: 'PURCHASE_ORDER',
      entityId: order.id,
      details: `Approved Purchase Order ${order.poNumber}.`,
    });

    return updated;
  },

  async reviseOrder(companyId, orderId, data, actor) {
    const order = await prisma.purchaseOrder.findFirst({ where: { id: orderId, companyId } });
    if (!order) throw purchaseError('Purchase order not found.', 404);
    if (!data.revisionReason?.trim()) throw purchaseError('Revision reason is mandatory to revise an approved Purchase Order.');

    const newVersion = (order.versionNumber || 1) + 1;
    const updated = await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        specialInstructions: data.specialInstructions || order.specialInstructions,
        terms: data.terms || order.terms,
        versionNumber: newVersion,
        isLocked: false,
      },
      include: { vendor: true, quotation: true },
    });

    await versionService.branchNewVersion({
      companyId,
      entityType: 'PURCHASE_ORDER',
      entityId: order.id,
      creatorId: actor?.id || 'SYSTEM',
      creatorName: actorName(actor),
      revisionReason,
      snapshotData: updated,
    }).catch(() => {});

    return updated;
  },

  // ====================================================================
  // 5. ARTWORK PROOF & DUAL APPROVAL (Design vs Commercial PO)
  // ====================================================================
  listArtworkProofs(companyId, options = {}) {
    const where = { companyId };
    if (options.vendorId) where.vendorId = options.vendorId;
    if (options.orderId) where.orderId = options.orderId;
    return prisma.purchaseArtworkProof.findMany({
      where,
      include: { order: true, vendor: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createArtworkProof(companyId, data, actor) {
    let vendorId = String(data.vendorId || '').trim();
    if (!vendorId && data.orderId) {
      const order = await prisma.purchaseOrder.findFirst({ where: { id: data.orderId, companyId }, select: { vendorId: true } });
      if (order?.vendorId) vendorId = order.vendorId;
    }

    if (!vendorId || !data.title?.trim()) {
      throw purchaseError('Vendor and artwork title are required.');
    }
    const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, companyId } });
    if (!vendor) throw purchaseError('Vendor not found.', 404);

    const proof = await prisma.purchaseArtworkProof.create({
      data: {
        companyId,
        vendorId: vendor.id,
        orderId: data.orderId || null,
        proofNo: data.proofNo?.trim() || documentNo('ART'),
        title: data.title.trim(),
        buyerArtworkUrl: data.buyerArtworkUrl?.trim() || null,
        supplierProofUrl: data.supplierProofUrl?.trim() || null,
        versionNumber: 1,
        designStatus: 'PENDING',
        commercialStatus: 'PENDING',
        comments: data.comments?.trim() || null,
      },
      include: { vendor: true, order: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'UPLOAD_ARTWORK_PROOF',
      entityType: 'ARTWORK_PROOF',
      entityId: proof.id,
      details: `Uploaded artwork proof ${proof.proofNo} for vendor ${vendor.name}.`,
    });

    return proof;
  },

  async reviewArtworkDesign(companyId, proofId, { decision, comments }, actor) {
    const proof = await prisma.purchaseArtworkProof.findFirst({ where: { id: proofId, companyId } });
    if (!proof) throw purchaseError('Artwork proof not found.', 404);
    if (!['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(decision)) {
      throw purchaseError('Invalid design review decision.');
    }

    const updated = await prisma.purchaseArtworkProof.update({
      where: { id: proof.id },
      data: {
        designStatus: decision,
        designApprovedById: actor?.id || 'DESIGN_HEAD',
        designApprovedByName: actorName(actor),
        designApprovedAt: new Date(),
        comments: comments?.trim() || proof.comments,
      },
      include: { vendor: true, order: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'REVIEW_ARTWORK_DESIGN',
      entityType: 'ARTWORK_PROOF',
      entityId: proof.id,
      details: `Design review decision: ${decision} by ${actorName(actor)}. Note: Commercial PO terms remain independent.`,
    });

    return updated;
  },

  async reviewArtworkCommercial(companyId, proofId, { decision, comments }, actor) {
    const proof = await prisma.purchaseArtworkProof.findFirst({ where: { id: proofId, companyId } });
    if (!proof) throw purchaseError('Artwork proof not found.', 404);

    const updated = await prisma.purchaseArtworkProof.update({
      where: { id: proof.id },
      data: {
        commercialStatus: decision === 'APPROVED' ? 'APPROVED' : 'PENDING_PO',
        commercialApprovedById: actor?.id || 'COMMERCIAL_HEAD',
        commercialApprovedByName: actorName(actor),
        commercialApprovedAt: new Date(),
        comments: comments?.trim() || proof.comments,
      },
      include: { vendor: true, order: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'REVIEW_ARTWORK_COMMERCIAL',
      entityType: 'ARTWORK_PROOF',
      entityId: proof.id,
      details: `Commercial review completed by ${actorName(actor)}. Note: Technical artwork design approval remains independent.`,
    });

    return updated;
  },

  // ====================================================================
  // 6. GOODS RECEIPT NOTE (GRN) & MULTIPLE PARTIAL RECEIPTS
  // ====================================================================
  listReceipts(companyId) {
    return prisma.purchaseReceipt.findMany({
      where: { companyId },
      include: { order: { include: { vendor: true } }, returns: true, deviations: true },
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

      // Calculate previous cumulative receipts per SKU
      const previousTotalReceived = new Map();
      const previousAccepted = new Map();
      for (const oldReceipt of order.receipts) {
        for (const line of Array.isArray(oldReceipt.items) ? oldReceipt.items : []) {
          previousTotalReceived.set(line.sku, (previousTotalReceived.get(line.sku) || 0) + Number(line.receivedQty || 0));
          previousAccepted.set(line.sku, (previousAccepted.get(line.sku) || 0) + Number(line.acceptedQty || 0));
        }
      }

      let totalShortQty = 0;
      let totalDamagedQty = 0;

      const items = data.items.map((line, index) => {
        const sku = cleanSku(line.sku);
        const ordered = orderedItems.find((item) => item.sku === sku);
        if (!ordered) throw purchaseError(`Received material ${sku || index + 1} is not on this purchase order.`);

        const receivedQty = positiveInt(line.receivedQty, `Received quantity for ${sku}`);
        const acceptedQty = nonNegativeInt(line.acceptedQty ?? receivedQty, `Accepted quantity for ${sku}`);
        const rejectedQty = nonNegativeInt(line.rejectedQty ?? 0, `Rejected quantity for ${sku}`);
        const damagedQty = nonNegativeInt(line.damagedQty ?? 0, `Damaged quantity for ${sku}`);
        const shortQty = nonNegativeInt(line.shortQty ?? 0, `Short quantity for ${sku}`);

        totalShortQty += shortQty;
        totalDamagedQty += damagedQty;

        if (acceptedQty + rejectedQty > receivedQty) {
          throw purchaseError(`Accepted (?${acceptedQty}) plus rejected (?${rejectedQty}) exceeds received quantity (?${receivedQty}) for ${sku}.`);
        }

        // Over-receipt prevention: Cumulative total cannot exceed ordered qty without tolerance
        const prevRec = previousTotalReceived.get(sku) || 0;
        const cumulativeTotal = prevRec + receivedQty;
        const allowedMax = Number(ordered.qty) * 1.05; // 5% standard manufacturing tolerance
        if (cumulativeTotal > allowedMax) {
          throw purchaseError(`Cumulative receipt (${cumulativeTotal} ${ordered.uom}) exceeds ordered quantity (${ordered.qty} ${ordered.uom}) beyond 5% tolerance.`);
        }

        const remainingBalance = Math.max(0, Number(ordered.qty) - cumulativeTotal);

        return {
          sku,
          name: ordered.name,
          uom: ordered.uom || 'PCS',
          orderedQty: Number(ordered.qty),
          previouslyReceived: prevRec,
          receivedQty,
          acceptedQty,
          rejectedQty,
          damagedQty,
          shortQty,
          orderBalance: remainingBalance,
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
          grnNo: data.grnNo?.trim() || documentNo('GRN'),
          warehouse,
          vehicleNo: String(data.vehicleNo || '').trim() || null,
          deliveryChallanNo: String(data.deliveryChallanNo || '').trim() || null,
          carrierName: String(data.carrierName || '').trim() || null,
          challanDate: parseDate(data.challanDate, 'Challan date'),
          items,
          receivedQty,
          acceptedQty,
          rejectedQty,
          shortQty: totalShortQty,
          damagedQty: totalDamagedQty,
          qcStatus: (rejectedQty > 0 || totalDamagedQty > 0 || totalShortQty > 0)
            ? (acceptedQty > 0 ? 'PARTIAL' : 'REJECTED')
            : 'PASSED',
          inspectionRemarks: String(data.inspectionRemarks || '').trim() || null,
          inspectorId: actor?.id || null,
          inspectorName: actorName(actor),
          inspectedAt: new Date(),
          receivedBy: actorName(actor),
          notes: String(data.notes || '').trim() || null,
        },
      });

      // Stock Control: Accepted stock -> Available Warehouse Stock
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

      // Deviation Management: If short, damaged or rejected goods exist, create deviation record
      let deviation = null;
      if (rejectedQty > 0 || totalDamagedQty > 0 || totalShortQty > 0) {
        const cat = rejectedQty > 0 ? 'REJECTED_QC' : totalDamagedQty > 0 ? 'DAMAGED_TRANSIT' : 'SHORTAGE';
        deviation = await tx.purchaseDeviation.create({
          data: {
            companyId,
            orderId: order.id,
            receiptId: receipt.id,
            vendorId: order.vendorId,
            deviationNo: documentNo('DEV'),
            deviationCategory: cat,
            affectedQty: rejectedQty + totalDamagedQty + totalShortQty,
            affectedSku: items.find(i => i.rejectedQty > 0 || i.damagedQty > 0 || i.shortQty > 0)?.sku || 'MULTIPLE',
            rootCause: `GRN Inspection detected discrepancies: ${rejectedQty} rejected, ${totalDamagedQty} damaged, ${totalShortQty} short.`,
            resolutionStatus: 'OPEN',
          },
        });
      }

      // Calculate new cumulative receipts and order status
      const allReceipts = await tx.purchaseReceipt.findMany({ where: { orderId: order.id } });
      const totalRecBySku = new Map();
      for (const cur of allReceipts) {
        for (const line of Array.isArray(cur.items) ? cur.items : []) {
          totalRecBySku.set(line.sku, (totalRecBySku.get(line.sku) || 0) + Number(line.receivedQty || 0));
        }
      }

      const fullyReceived = orderedItems.every((line) => (totalRecBySku.get(line.sku) || 0) >= Number(line.qty));
      const orderStatus = fullyReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: orderStatus, closedAt: fullyReceived ? new Date() : null },
      });

      return {
        ...receipt,
        receipt,
        deviation,
        orderStatus,
      };
    });
  },

  // ====================================================================
  // 7. DEVIATION RESOLUTION & DISPATCH
  // ====================================================================
  listDeviations(companyId) {
    return prisma.purchaseDeviation.findMany({
      where: { companyId },
      include: { order: true, receipt: true, vendor: true, bills: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async resolveDeviation(companyId, deviationId, data, actor) {
    const dev = await prisma.purchaseDeviation.findFirst({ where: { id: deviationId, companyId } });
    if (!dev) throw purchaseError('Deviation not found.', 404);

    const updated = await prisma.purchaseDeviation.update({
      where: { id: dev.id },
      data: {
        resolutionStatus: 'RESOLVED',
        supplierResponse: String(data.supplierResponse || '').trim() || null,
        correctiveAction: String(data.correctiveAction || '').trim() || null,
        resolvedById: actor?.id || 'SYSTEM',
        resolvedByName: actorName(actor),
        resolvedAt: new Date(),
      },
      include: { order: true, receipt: true, vendor: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'RESOLVE_DEVIATION',
      entityType: 'PURCHASE_DEVIATION',
      entityId: dev.id,
      details: `Resolved deviation ${dev.deviationNo}. Action: ${data.correctiveAction || 'Settled'}`,
    });

    return updated;
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

  // ====================================================================
  // 8. SUPPLIER BILL & FULL INVOICE PAYMENT HOLD
  // ====================================================================
  listBills(companyId) {
    return prisma.purchaseBill.findMany({
      where: { companyId },
      include: { order: { include: { vendor: true } }, holdDeviation: true },
      orderBy: { invoiceDate: 'desc' },
    });
  },

  async createBill(companyId, orderId, data, actor) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: orderId, companyId },
      include: { receipts: true, bill: true, deviations: true },
    });
    if (!order) throw purchaseError('Purchase order not found.', 404);
    if (order.bill) throw purchaseError('A bill already exists for this purchase order.', 409);
    if (!order.receipts.some((receipt) => receipt.acceptedQty > 0)) {
      throw purchaseError('Record an accepted goods receipt before creating the purchase bill.', 409);
    }

    const vendorInvoiceNo = String(data.vendorInvoiceNo || '').trim();
    if (!vendorInvoiceNo) throw purchaseError('Vendor invoice number is required.');
    const taxableAmount = nonNegativeMoney(data.taxableAmount ?? order.subtotal, 'Taxable amount');
    const taxAmount = nonNegativeMoney(data.taxAmount ?? order.taxAmount, 'Tax amount');
    const otherCharges = nonNegativeMoney(data.otherCharges ?? order.freightAmount, 'Other charges');

    // Rule: Full Invoice Payment Hold if short, damaged or rejected goods exist
    const hasOpenDeviation = order.deviations?.some(d => d.resolutionStatus === 'OPEN');
    const hasRejectedOrDamaged = order.receipts?.some(r => r.rejectedQty > 0 || r.damagedQty > 0 || r.shortQty > 0);
    const shouldHoldPayment = Boolean(hasOpenDeviation || hasRejectedOrDamaged);

    const openDev = order.deviations?.find(d => d.resolutionStatus === 'OPEN');

    const bill = await prisma.purchaseBill.create({
      data: {
        companyId,
        orderId: order.id,
        billNo: data.billNo?.trim() || documentNo('BILL'),
        vendorInvoiceNo,
        invoiceDate: parseDate(data.invoiceDate, 'Invoice date') || new Date(),
        dueDate: parseDate(data.dueDate, 'Due date'),
        taxableAmount,
        taxAmount,
        otherCharges,
        totalAmount: taxableAmount + taxAmount + otherCharges,
        status: shouldHoldPayment ? 'PAYMENT_HOLD' : 'UNPAID',
        paymentHold: shouldHoldPayment,
        holdReason: shouldHoldPayment
          ? 'GRN Quality Inspection detected short/damaged/rejected materials. Full invoice payment held pending deviation resolution.'
          : null,
        holdDeviationId: openDev ? openDev.id : null,
        notes: String(data.notes || '').trim() || null,
      },
      include: { order: { include: { vendor: true } }, holdDeviation: true },
    });

    if (shouldHoldPayment) {
      await notificationService.createNotification({
        companyId,
        recipientId: 'ACCOUNTS',
        category: 'ALERT',
        title: `Full Payment Hold on Invoice: ${vendorInvoiceNo}`,
        message: `Supplier invoice ${vendorInvoiceNo} for order ${order.poNumber} placed on FULL PAYMENT HOLD due to GRN quality inspection discrepancy.`,
        entityType: 'PURCHASE_BILL',
        entityId: bill.id,
      }).catch(() => {});
    }

    return bill;
  },

  async releasePaymentHold(companyId, billId, { reason, deviationResolution }, actor) {
    const bill = await prisma.purchaseBill.findFirst({
      where: { id: billId, companyId },
      include: { order: true, holdDeviation: true },
    });
    if (!bill) throw purchaseError('Purchase bill not found.', 404);
    if (!bill.paymentHold) throw purchaseError('This bill is not currently on payment hold.');
    if (!reason?.trim()) throw purchaseError('Hold release reason and authorization justification are required.');

    const updated = await prisma.purchaseBill.update({
      where: { id: bill.id },
      data: {
        paymentHold: false,
        status: 'UNPAID',
        holdReleasedById: actor?.id || 'ACCOUNTS_HEAD',
        holdReleasedByName: actorName(actor),
        holdReleasedAt: new Date(),
        holdReleaseReason: reason.trim(),
      },
      include: { order: { include: { vendor: true } }, holdDeviation: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'RELEASE_PAYMENT_HOLD',
      entityType: 'PURCHASE_BILL',
      entityId: bill.id,
      details: `Released full payment hold for supplier bill ${bill.vendorInvoiceNo}. Justification: ${reason}`,
    });

    return updated;
  },

  async markBillPaid(companyId, billId, data, actor) {
    const bill = await prisma.purchaseBill.findFirst({ where: { id: billId, companyId } });
    if (!bill) throw purchaseError('Purchase bill not found.', 404);

    // Rule: Strictly prevent payment release while full invoice payment hold is active
    if (bill.paymentHold) {
      throw purchaseError(
        `Cannot process payment: Supplier invoice ${bill.vendorInvoiceNo} is on FULL PAYMENT HOLD due to unresolved GRN discrepancies. Authorized hold release is required before payment.`,
        400
      );
    }

    const updated = await prisma.purchaseBill.update({
      where: { id: bill.id },
      data: {
        status: 'PAID',
        paymentReference: String(data.paymentReference || '').trim() || null,
        paidAt: new Date(),
      },
      include: { order: { include: { vendor: true } } },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'PAY_PURCHASE_BILL',
      entityType: 'PURCHASE_BILL',
      entityId: bill.id,
      details: `Paid supplier invoice ${bill.vendorInvoiceNo} (${bill.totalAmount}) ref: ${data.paymentReference || 'N/A'}.`,
    });

    return updated;
  },
};

export default purchaseService;
