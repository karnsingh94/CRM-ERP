import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.js';
import { approvalService } from '../approval.service.js';
import { auditService } from '../audit.service.js';

function jwError(message, statusCode = 400, code = 'JOB_WORK_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function round4(val) {
  return Math.round((Number(val) || 0) * 10000) / 10000;
}

function round2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function generateDocNo(prefix = 'JWO') {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${dateStr}-${rand}`;
}

export const jobWorkService = {
  // ====================================================================
  // 1. DASHBOARD & KPIS
  // ====================================================================

  async getDashboardMetrics(companyId) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const [
      orders,
      challans,
      receipts,
      returns,
      reconciliations,
      activeVendors,
    ] = await Promise.all([
      prisma.jobWorkOrder.findMany({
        where: { companyId },
        select: { id: true, status: true, targetQuantity: true, receivedQuantity: true, rejectedQuantity: true, estimatedTotalCost: true },
      }),
      prisma.jobWorkChallan.findMany({
        where: { companyId },
        select: { id: true, status: true, statutory1YearDueDate: true, totalTaxableValue: true },
      }),
      prisma.jobWorkReceipt.findMany({
        where: { companyId },
        select: { id: true, qcStatus: true, receivedQty: true, acceptedQty: true, rejectedQty: true },
      }),
      prisma.jobWorkMaterialReturn.findMany({
        where: { companyId },
        select: { id: true, quantityReturned: true },
      }),
      prisma.jobWorkReconciliation.findMany({
        where: { companyId },
        select: { id: true, settlementStatus: true, isPaymentHold: true, netPayableToVendor: true, excessWastageDebit: true },
      }),
      prisma.vendor.count({
        where: { companyId, status: 'ACTIVE' },
      }),
    ]);

    const now = new Date();
    const metrics = {
      orders: {
        total: orders.length,
        draft: orders.filter((o) => o.status === 'DRAFT').length,
        pendingApproval: orders.filter((o) => o.status === 'PENDING_APPROVAL').length,
        approved: orders.filter((o) => o.status === 'APPROVED').length,
        inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
        completed: orders.filter((o) => o.status === 'COMPLETED').length,
        cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
      },
      challans: {
        total: challans.length,
        dispatched: challans.filter((c) => c.status === 'DISPATCHED').length,
        delivered: challans.filter((c) => c.status === 'DELIVERED').length,
        overdue1Year: challans.filter((c) => c.statutory1YearDueDate && new Date(c.statutory1YearDueDate) < now && c.status !== 'COMPLETED').length,
      },
      receipts: {
        total: receipts.length,
        pendingQc: receipts.filter((r) => r.qcStatus === 'PENDING_QC').length,
        passed: receipts.filter((r) => r.qcStatus === 'PASSED').length,
        rejected: receipts.filter((r) => r.qcStatus === 'REJECTED').length,
        partiallyPassed: receipts.filter((r) => r.qcStatus === 'PARTIALLY_PASSED').length,
      },
      returns: {
        totalCount: returns.length,
        totalQuantity: returns.reduce((sum, r) => sum + Number(r.quantityReturned || 0), 0),
      },
      reconciliations: {
        total: reconciliations.length,
        pendingAudit: reconciliations.filter((rec) => rec.settlementStatus === 'PENDING_AUDIT').length,
        audited: reconciliations.filter((rec) => rec.settlementStatus === 'AUDITED').length,
        settled: reconciliations.filter((rec) => rec.settlementStatus === 'SETTLED').length,
        paymentHoldCount: reconciliations.filter((rec) => rec.isPaymentHold).length,
      },
      contractManufacturers: {
        activeVendorCount: activeVendors,
      },
    };

    return metrics;
  },

  // ====================================================================
  // 2. CONTRACT MANUFACTURER DIRECTORY & CAPABILITY
  // ====================================================================

  async listContractManufacturers(companyId, query = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const where = { companyId };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { vendorCode: { contains: query.search } },
        { contact: { contains: query.search } },
      ];
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        jobWorkOrders: {
          select: { id: true, status: true, targetQuantity: true, receivedQuantity: true },
        },
        jobWorkChallans: {
          select: { id: true, status: true, statutory1YearDueDate: true },
        },
      },
    });

    return vendors.map((v) => {
      const activeOrders = v.jobWorkOrders.filter((o) => ['APPROVED', 'IN_PROGRESS'].includes(o.status));
      const completedOrders = v.jobWorkOrders.filter((o) => o.status === 'COMPLETED');
      const openChallans = v.jobWorkChallans.filter((c) => c.status !== 'COMPLETED');

      return {
        id: v.id,
        vendorCode: v.vendorCode,
        name: v.name,
        category: v.category,
        contact: v.contact,
        email: v.email,
        phone: v.phone,
        status: v.status,
        address: v.address,
        activeOrdersCount: activeOrders.length,
        completedOrdersCount: completedOrders.length,
        openChallansCount: openChallans.length,
        isContractManufacturer: true,
      };
    });
  },

  async getManufacturerHistory(companyId, vendorId) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
      include: {
        jobWorkOrders: {
          orderBy: { createdAt: 'desc' },
          include: {
            outputProduct: { select: { id: true, sku: true, name: true } },
            bom: { select: { id: true, bomCode: true, bomName: true, version: true } },
            receipts: { select: { id: true, receiptNo: true, receivedQty: true, acceptedQty: true, rejectedQty: true, qcStatus: true } },
          },
        },
        jobWorkChallans: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!vendor) throw jwError('Vendor not found in active company.', 404);
    return vendor;
  },

  // ====================================================================
  // 3. JOB WORK ORDERS CRUD & APPROVAL ENGINE
  // ====================================================================

  async createJobWorkOrder(companyId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);
    if (!data.vendorId) throw jwError('Contract manufacturer / vendor ID is required.');
    if (!data.outputProductId) throw jwError('Output product ID is required.');
    if (!data.bomId) throw jwError('BOM ID is required.');

    const targetQuantity = Number(data.targetQuantity);
    if (!targetQuantity || targetQuantity <= 0) {
      throw jwError('Target quantity must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Verify vendor
      const vendor = await tx.vendor.findFirst({ where: { id: data.vendorId, companyId } });
      if (!vendor) throw jwError('Selected vendor not found in active company.', 404);

      // 2. Verify output product
      const product = await tx.product.findFirst({ where: { id: data.outputProductId, companyId } });
      if (!product) throw jwError('Output finished product not found in active company.', 404);

      // 3. Verify approved BOM
      const bom = await tx.bomMaster.findFirst({
        where: { id: data.bomId, companyId },
        include: { items: { include: { product: true } } },
      });
      if (!bom) throw jwError('BOM formula not found in active company.', 404);
      if (bom.status !== 'APPROVED') {
        throw jwError(`BOM version ${bom.bomCode} (v${bom.version}) must be APPROVED before creating a Job Work Order. Current status: ${bom.status}.`, 400);
      }
      if (bom.outputProductId !== product.id) {
        throw jwError('Selected BOM does not match the chosen output finished product.', 400);
      }

      // 4. Optional Production Order check
      let productionOrder = null;
      if (data.productionOrderId) {
        productionOrder = await tx.productionOrder.findFirst({
          where: { id: data.productionOrderId, companyId },
        });
        if (!productionOrder) throw jwError('Linked internal production order not found in active company.', 404);
      }

      const orderNo = String(data.orderNo || generateDocNo('JWO')).trim().toUpperCase();
      const existing = await tx.jobWorkOrder.findUnique({
        where: { companyId_orderNo: { companyId, orderNo } },
      });
      if (existing) throw jwError(`Job Work Order with number ${orderNo} already exists.`, 409);

      const conversionRate = Number(data.conversionRate) || 0.0;
      const estimatedTotalCost = round2(targetQuantity * conversionRate);
      const taxableValue = Number(data.taxableValue) || estimatedTotalCost;

      // 5. Create Order Header
      const order = await tx.jobWorkOrder.create({
        data: {
          companyId,
          orderNo,
          vendorId: vendor.id,
          productionOrderId: productionOrder?.id || null,
          outputProductId: product.id,
          bomId: bom.id,
          targetQuantity,
          receivedQuantity: 0.0,
          rejectedQuantity: 0.0,
          uom: String(data.uom || bom.uom || 'KG').toUpperCase(),
          conversionRate,
          estimatedTotalCost,
          taxableValue,
          status: 'DRAFT',
          issueDate: new Date(data.issueDate || Date.now()),
          expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
          deliveryAddress: data.deliveryAddress || vendor.address || null,
          termsAndConditions: data.termsAndConditions || null,
          versionNumber: 1,
          isLocked: false,
          createdById: actor.id || actor.userId || null,
        },
      });

      // 6. Generate JWO Item Requirements from BOM items
      const bomBatchSize = Number(bom.batchSize) || 1.0;
      const multiplier = targetQuantity / bomBatchSize;

      for (const bItem of bom.items) {
        const itemQty = Number(bItem.quantityPerBatch !== undefined ? bItem.quantityPerBatch : bItem.quantity) || 0;
        const requiredQuantity = round4(itemQty * multiplier);
        const scrapTolerance = Number(bItem.scrapTolerancePct || bItem.scrapPercentage || 0);
        const standardCost = Number(
          bItem.standardUnitCost !== undefined && Number(bItem.standardUnitCost) > 0
            ? bItem.standardUnitCost
            : (bItem.standardCost || bItem.product?.purchasePrice || bItem.product?.costPrice || bItem.product?.sellingPrice || bItem.product?.unitPrice || 0)
        );

        await tx.jobWorkOrderItem.create({
          data: {
            companyId,
            jobWorkOrderId: order.id,
            productId: bItem.productId,
            itemType: bItem.itemType || 'RAW_MATERIAL',
            requiredQuantity,
            dispatchedQuantity: 0.0,
            consumedQuantity: 0.0,
            returnedQuantity: 0.0,
            uom: bItem.uom || 'KG',
            scrapTolerancePct: scrapTolerance,
            standardUnitCost: standardCost,
          },
        });
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'JOB_WORK_ORDER_CREATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'job_work',
        details: `Created Job Work Order ${order.orderNo} for ${targetQuantity} ${order.uom} of ${product.sku} assigned to vendor ${vendor.name}.`,
      });

      return tx.jobWorkOrder.findUnique({
        where: { id: order.id },
        include: {
          vendor: true,
          outputProduct: true,
          bom: true,
          items: { include: { product: true } },
        },
      });
    });
  },

  async listJobWorkOrders(companyId, query = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const where = { companyId };
    if (query.status) where.status = query.status;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.outputProductId) where.outputProductId = query.outputProductId;
    if (query.search) {
      where.OR = [
        { orderNo: { contains: query.search } },
        { vendor: { name: { contains: query.search } } },
        { outputProduct: { sku: { contains: query.search } } },
      ];
    }

    return prisma.jobWorkOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { id: true, name: true, vendorCode: true } },
        outputProduct: { select: { id: true, sku: true, name: true } },
        bom: { select: { id: true, bomCode: true, bomName: true, version: true } },
        _count: {
          select: { items: true, challans: true, receipts: true, milestones: true },
        },
      },
    });
  },

  async getJobWorkOrderById(companyId, orderId) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const order = await prisma.jobWorkOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        vendor: true,
        outputProduct: true,
        bom: { include: { items: { include: { product: true } } } },
        productionOrder: true,
        items: { include: { product: true } },
        challans: {
          orderBy: { createdAt: 'desc' },
          include: { warehouse: true, items: { include: { product: true, rmBatch: true } } },
        },
        milestones: { orderBy: { statusDate: 'asc' } },
        receipts: {
          orderBy: { receivedAt: 'desc' },
          include: { warehouse: true, createdInventoryBatch: true },
        },
        materialReturns: {
          orderBy: { returnedAt: 'desc' },
          include: { rmBatch: true },
        },
        reconciliations: {
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } },
        },
      },
    });

    if (!order) throw jwError('Job Work Order not found in active company.', 404);
    return order;
  },

  async updateJobWorkOrder(companyId, orderId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const order = await prisma.jobWorkOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw jwError('Job Work Order not found.', 404);

    if (order.isLocked || !['DRAFT', 'PENDING_APPROVAL'].includes(order.status)) {
      throw jwError(`Order ${order.orderNo} is locked or approved and cannot be directly modified. Status: ${order.status}.`, 403);
    }

    const updated = await prisma.jobWorkOrder.update({
      where: { id: order.id },
      data: {
        deliveryAddress: data.deliveryAddress !== undefined ? data.deliveryAddress : order.deliveryAddress,
        expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : order.expectedReturnDate,
        termsAndConditions: data.termsAndConditions !== undefined ? data.termsAndConditions : order.termsAndConditions,
        conversionRate: data.conversionRate !== undefined ? Number(data.conversionRate) : order.conversionRate,
        taxableValue: data.taxableValue !== undefined ? Number(data.taxableValue) : order.taxableValue,
        estimatedTotalCost: data.conversionRate !== undefined ? round2(Number(order.targetQuantity) * Number(data.conversionRate)) : order.estimatedTotalCost,
      },
      include: { vendor: true, outputProduct: true, bom: true, items: { include: { product: true } } },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'System',
      action: 'JOB_WORK_ORDER_UPDATE',
      serviceCode: 'manufacturing_production',
      moduleCode: 'job_work',
      details: `Updated Job Work Order ${order.orderNo}.`,
    });

    return updated;
  },

  async submitOrderForApproval(companyId, orderId, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const order = await prisma.jobWorkOrder.findFirst({
      where: { id: orderId, companyId },
      include: { vendor: true, outputProduct: true },
    });
    if (!order) throw jwError('Job Work Order not found.', 404);

    if (order.status !== 'DRAFT') {
      throw jwError(`Job Work Order can only be submitted from DRAFT status. Current status: ${order.status}.`, 400);
    }

    const updated = await prisma.jobWorkOrder.update({
      where: { id: order.id },
      data: { status: 'PENDING_APPROVAL' },
    });

    await approvalService.createRequest({
      companyId,
      entityType: 'JOB_WORK_ORDER',
      entityId: order.id,
      title: `Job Work Order Approval: ${order.orderNo}`,
      summary: `Subcontracting order for ${order.targetQuantity} ${order.uom} of ${order.outputProduct.sku} to ${order.vendor.name}. Estimated Cost: ₹${order.estimatedTotalCost}`,
      creatorId: actor.id || actor.userId,
      creatorName: actor.name || 'Plant Supervisor',
      role: actor.role || 'COMPANY_USER',
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'System',
      action: 'JOB_WORK_ORDER_SUBMIT_APPROVAL',
      serviceCode: 'manufacturing_production',
      moduleCode: 'job_work',
      details: `Submitted Job Work Order ${order.orderNo} for Phase 1 Approval Engine evaluation.`,
    });

    return updated;
  },

  async approveJobWorkOrder(companyId, orderId, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const order = await prisma.jobWorkOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw jwError('Job Work Order not found.', 404);

    // Segregation of Duties (Maker-Checker): Creator cannot approve their own order
    const actorId = actor.id || actor.userId;
    if (order.createdById && actorId && String(order.createdById) === String(actorId)) {
      throw jwError('Segregation of Duties (SoD) violation: The creator of a Job Work Order cannot approve it.', 403, 'SOD_VIOLATION');
    }

    if (!['DRAFT', 'PENDING_APPROVAL'].includes(order.status)) {
      throw jwError(`Job Work Order cannot be approved from current status: ${order.status}.`, 400);
    }

    const updated = await prisma.jobWorkOrder.update({
      where: { id: order.id },
      data: {
        status: 'APPROVED',
        isLocked: true,
        approvedById: actorId || null,
        approvedAt: new Date(),
      },
      include: { vendor: true, outputProduct: true, bom: true, items: true },
    });

    await auditService.logAudit({
      companyId,
      actorId: actorId || 'system',
      actorName: actor.name || 'System',
      action: 'JOB_WORK_ORDER_APPROVE',
      serviceCode: 'manufacturing_production',
      moduleCode: 'job_work',
      details: `Approved Job Work Order ${order.orderNo}. Order is now locked against modification.`,
    });

    return updated;
  },

  // ====================================================================
  // 4. MATERIAL REQUIREMENTS CALCULATION & FIFO DISPATCH (CHALLAN)
  // ====================================================================

  async calculateMaterialRequirements(companyId, orderId) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const order = await prisma.jobWorkOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        items: { include: { product: true } },
      },
    });
    if (!order) throw jwError('Job Work Order not found.', 404);

    const requirements = [];
    for (const item of order.items) {
      // Find total available stock across warehouses
      const stocks = await prisma.inventoryStock.findMany({
        where: { companyId, productId: item.productId },
      });
      const totalAvailable = stocks.reduce((sum, s) => sum + (s.availableQty || 0), 0);
      const totalWip = stocks.reduce((sum, s) => sum + (s.wipQty || 0), 0);

      const remainingToDispatch = Math.max(0, Number(item.requiredQuantity) - Number(item.dispatchedQuantity));
      const hasShortage = totalAvailable < remainingToDispatch;

      requirements.push({
        id: item.id,
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        uom: item.uom,
        requiredQuantity: Number(item.requiredQuantity),
        dispatchedQuantity: Number(item.dispatchedQuantity),
        consumedQuantity: Number(item.consumedQuantity),
        returnedQuantity: Number(item.returnedQuantity),
        remainingToDispatch,
        totalAvailableStock: totalAvailable,
        totalWipStock: totalWip,
        hasShortage,
        shortageQuantity: hasShortage ? remainingToDispatch - totalAvailable : 0,
      });
    }

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      status: order.status,
      requirements,
    };
  },

  async dispatchMaterials(companyId, orderId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);
    if (!data.warehouseId) throw jwError('Source warehouse ID is required for dispatch.');

    return prisma.$transaction(async (tx) => {
      // 1. Verify Order
      const order = await tx.jobWorkOrder.findFirst({
        where: { id: orderId, companyId },
        include: {
          items: { include: { product: true } },
          vendor: true,
        },
      });
      if (!order) throw jwError('Job Work Order not found.', 404);

      if (!['APPROVED', 'IN_PROGRESS'].includes(order.status)) {
        throw jwError(`Materials can only be dispatched for APPROVED or IN_PROGRESS orders. Current status: ${order.status}.`, 400);
      }

      // 2. Verify Warehouse
      const warehouse = await tx.inventoryWarehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });
      if (!warehouse) throw jwError('Source warehouse not found in active company.', 404);

      // Determine dispatch quantities: custom items array or auto-dispatch remaining requirements
      const dispatchPlan = data.items || order.items.map((it) => ({
        productId: it.productId,
        quantity: Math.max(0, Number(it.requiredQuantity) - Number(it.dispatchedQuantity)),
      }));

      const activeDispatches = dispatchPlan.filter((p) => Number(p.quantity) > 0);
      if (activeDispatches.length === 0) {
        throw jwError('No pending material quantities to dispatch.', 400);
      }

      // Create Challan Header
      const challanNo = String(data.challanNo || generateDocNo('JWC')).trim().toUpperCase();
      const existingChallan = await tx.jobWorkChallan.findUnique({
        where: { companyId_challanNo: { companyId, challanNo } },
      });
      if (existingChallan) throw jwError(`Challan with number ${challanNo} already exists.`, 409);

      const dispatchDate = new Date(data.dispatchDate || Date.now());
      // Statutory 1-Year Due Date under CGST Section 143 / Rule 55
      const statutory1YearDueDate = new Date(dispatchDate.getTime() + 365 * 86400000);

      const challan = await tx.jobWorkChallan.create({
        data: {
          companyId,
          challanNo,
          jobWorkOrderId: order.id,
          vendorId: order.vendorId,
          warehouseId: warehouse.id,
          dispatchDate,
          statutory1YearDueDate,
          transporterName: data.transporterName || null,
          vehicleNo: data.vehicleNo || null,
          lrNumber: data.lrNumber || null,
          eWayBillNo: data.eWayBillNo || null,
          destinationAddress: data.destinationAddress || order.deliveryAddress || order.vendor.address || 'Vendor Factory',
          totalTaxableValue: 0.0,
          status: 'DISPATCHED',
          statutoryDeclaration: 'Goods dispatched under Section 143 read with Rule 55 of CGST Act. Returnable within one year.',
          notes: data.notes || null,
          createdById: actor.id || actor.userId || null,
        },
      });

      let totalChallanTaxableValue = 0.0;

      // 3. FIFO Batch Allocation for each item
      for (const reqItem of activeDispatches) {
        const orderItem = order.items.find((it) => it.productId === reqItem.productId);
        if (!orderItem) {
          throw jwError(`Product ID ${reqItem.productId} is not part of this Job Work Order.`, 400);
        }

        const requestedQty = Number(reqItem.quantity);
        const maxPermitted = Number(orderItem.requiredQuantity) * (1 + Number(orderItem.scrapTolerancePct) / 100);
        const remainingAllowed = maxPermitted - Number(orderItem.dispatchedQuantity);

        if (requestedQty > remainingAllowed + 0.0001) {
          throw jwError(`Dispatch quantity (${requestedQty} ${orderItem.uom}) exceeds allowed order limit for ${orderItem.product.sku} (Remaining: ${remainingAllowed.toFixed(4)}).`, 409);
        }

        // Find active batches for product in warehouse (FIFO order)
        const batches = await tx.inventoryBatch.findMany({
          where: {
            companyId,
            productId: reqItem.productId,
            warehouse: warehouse.name,
            status: 'ACTIVE',
            availableQty: { gt: 0 },
          },
          orderBy: [
            { manufacturingDate: 'asc' },
            { receivedDate: 'asc' },
            { createdAt: 'asc' },
          ],
        });

        const totalAvailableInBatches = batches.reduce((sum, b) => sum + (b.availableQty || 0), 0);
        if (totalAvailableInBatches < requestedQty) {
          throw jwError(`Insufficient available stock for ${orderItem.product.sku} in ${warehouse.name}. Needed: ${requestedQty}, Available in lots: ${totalAvailableInBatches}.`, 409);
        }

        let needed = requestedQty;
        for (const lot of batches) {
          if (needed <= 0) break;
          const take = Math.min(needed, lot.availableQty);
          needed = round4(needed - take);

          // Decrement AVAILABLE, increment WIP on batch lot
          await tx.inventoryBatch.update({
            where: { id: lot.id },
            data: {
              availableQty: { decrement: take },
              wipQty: { increment: take },
            },
          });

          // Update InventoryStock
          const stock = await tx.inventoryStock.findFirst({
            where: { companyId, productId: reqItem.productId, warehouse: warehouse.name },
          });
          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                availableQty: { decrement: take },
                wipQty: { increment: take },
                stock: { decrement: take },
              },
            });
          }

          const unitCost = Number(lot.unitCost) || Number(orderItem.standardUnitCost) || 0.0;
          const taxableValue = round2(take * unitCost);
          totalChallanTaxableValue += taxableValue;

          // Record InventoryMovement
          const movement = await tx.inventoryMovement.create({
            data: {
              companyId,
              stockId: stock?.id || null,
              batchId: lot.id,
              batchNo: lot.batchNo,
              movementNo: generateDocNo('MOV'),
              movementType: 'JOB_WORK_DISPATCH',
              sku: orderItem.product.sku,
              itemName: orderItem.product.name,
              warehouse: warehouse.name,
              quantity: take,
              balanceAfter: Math.max(0, (stock?.availableQty || 0) - take),
              sourceBucket: 'AVAILABLE',
              destinationBucket: 'WIP',
              uom: orderItem.uom,
              unitCost,
              referenceType: 'JOB_WORK_CHALLAN',
              referenceId: challan.id,
              referenceNo: challan.challanNo,
              notes: `Dispatched to external manufacturer ${order.vendor.name} on Challan ${challan.challanNo}`,
              createdBy: actor.name || 'System',
              approvedBy: actor.name || 'Plant Supervisor',
            },
          });

          // Create Challan Item Line
          await tx.jobWorkChallanItem.create({
            data: {
              companyId,
              challanId: challan.id,
              productId: reqItem.productId,
              rmBatchId: lot.id,
              rmBatchNo: lot.batchNo,
              sku: orderItem.product.sku,
              hsnCode: orderItem.product.hsnCode || null,
              quantityDispatched: take,
              uom: orderItem.uom,
              unitCost,
              taxableValue,
              movementId: movement.id,
            },
          });
        }

        // Increment dispatched quantity on order item
        await tx.jobWorkOrderItem.update({
          where: { id: orderItem.id },
          data: {
            dispatchedQuantity: { increment: requestedQty },
          },
        });
      }

      // Update total taxable value on challan
      await tx.jobWorkChallan.update({
        where: { id: challan.id },
        data: { totalTaxableValue: totalChallanTaxableValue },
      });

      // Update JWO status to IN_PROGRESS
      await tx.jobWorkOrder.update({
        where: { id: order.id },
        data: { status: 'IN_PROGRESS' },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'JOB_WORK_DISPATCH_CREATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'job_work',
        details: `Dispatched raw materials on Challan ${challan.challanNo} for Order ${order.orderNo} to vendor ${order.vendor.name}.`,
      });

      return tx.jobWorkChallan.findUnique({
        where: { id: challan.id },
        include: {
          items: { include: { product: true, rmBatch: true } },
          warehouse: true,
          vendor: true,
          jobWorkOrder: true,
        },
      });
    });
  },

  // ====================================================================
  // 5. CHALLANS & VENDOR ACKNOWLEDGEMENT
  // ====================================================================

  async listChallans(companyId, query = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const where = { companyId };
    if (query.jobWorkOrderId) where.jobWorkOrderId = query.jobWorkOrderId;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.status) where.status = query.status;
    if (query.isOverdue === 'true') {
      where.statutory1YearDueDate = { lt: new Date() };
      where.status = { not: 'COMPLETED' };
    }

    return prisma.jobWorkChallan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { id: true, name: true, vendorCode: true } },
        warehouse: { select: { id: true, name: true } },
        jobWorkOrder: { select: { id: true, orderNo: true, status: true } },
        _count: { select: { items: true } },
      },
    });
  },

  async getChallanById(companyId, challanId) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const challan = await prisma.jobWorkChallan.findFirst({
      where: { id: challanId, companyId },
      include: {
        vendor: true,
        warehouse: true,
        jobWorkOrder: { include: { outputProduct: true } },
        items: { include: { product: true, rmBatch: true } },
      },
    });

    if (!challan) throw jwError('Job Work Challan not found in active company.', 404);
    return challan;
  },

  async acknowledgeChallan(companyId, challanId, data = {}, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const challan = await prisma.jobWorkChallan.findFirst({
      where: { id: challanId, companyId },
      include: { vendor: true, jobWorkOrder: true },
    });
    if (!challan) throw jwError('Job Work Challan not found.', 404);

    const acknowledgedAt = new Date(data.acknowledgedAt || Date.now());
    const acknowledgedBy = data.acknowledgedBy || actor.name || 'Vendor Authorized Signatory';

    const updated = await prisma.jobWorkChallan.update({
      where: { id: challan.id },
      data: {
        status: 'DELIVERED',
        acknowledgedAt,
        acknowledgedBy,
      },
      include: { vendor: true, items: true },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'System',
      action: 'JOB_WORK_CHALLAN_ACKNOWLEDGE',
      serviceCode: 'manufacturing_production',
      moduleCode: 'job_work',
      details: `Vendor ${challan.vendor.name} acknowledged receipt of materials on Challan ${challan.challanNo}. Acknowledged by ${acknowledgedBy}.`,
    });

    return updated;
  },

  // ====================================================================
  // 6. EXTERNAL MATERIAL RETURNS
  // ====================================================================

  async returnMaterials(companyId, orderId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw jwError('At least one material return item is required.', 400);
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.jobWorkOrder.findFirst({
        where: { id: orderId, companyId },
        include: { items: { include: { product: true } }, vendor: true },
      });
      if (!order) throw jwError('Job Work Order not found.', 404);

      const warehouse = await tx.inventoryWarehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });
      if (!warehouse) throw jwError('Receiving warehouse not found in active company.', 404);

      const returnRecords = [];

      for (const item of data.items) {
        const orderItem = order.items.find((it) => it.productId === item.productId);
        if (!orderItem) throw jwError(`Product ID ${item.productId} is not on this Job Work Order.`, 400);

        const qty = Number(item.quantity);
        if (qty <= 0) throw jwError('Returned quantity must be greater than zero.', 400);

        // Check outstanding custody
        const outstanding = Number(orderItem.dispatchedQuantity) - Number(orderItem.consumedQuantity) - Number(orderItem.returnedQuantity);
        if (qty > outstanding + 0.0001) {
          throw jwError(
            `Cannot return ${qty} ${orderItem.uom} of ${orderItem.product.sku}. Outstanding vendor custody is only ${outstanding.toFixed(4)} ${orderItem.uom}.`,
            409
          );
        }

        // Verify RM batch
        const rmBatch = await tx.inventoryBatch.findFirst({
          where: { id: item.rmBatchId, companyId },
        });
        if (!rmBatch) throw jwError(`Raw material batch lot ${item.rmBatchId} not found in company.`, 404);

        const returnNo = String(item.returnNo || generateDocNo('JWRT')).trim().toUpperCase();

        // Target bucket: AVAILABLE for good unconsumed material, or RETURN_HOLD for defectives
        const targetBucket = item.isDefective ? 'RETURN_HOLD' : 'AVAILABLE';

        // 1. Decrement WIP on batch lot
        await tx.inventoryBatch.update({
          where: { id: rmBatch.id },
          data: {
            wipQty: { decrement: qty },
            ...(targetBucket === 'AVAILABLE' ? { availableQty: { increment: qty } } : { returnHoldQty: { increment: qty } }),
          },
        });

        // 2. Decrement WIP on stock master
        const stock = await tx.inventoryStock.findFirst({
          where: { companyId, productId: item.productId, warehouse: warehouse.name },
        });
        if (stock) {
          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: {
              wipQty: { decrement: qty },
              ...(targetBucket === 'AVAILABLE' ? { availableQty: { increment: qty }, stock: { increment: qty } } : { returnHoldQty: { increment: qty } }),
            },
          });
        }

        // 3. Movement
        await tx.inventoryMovement.create({
          data: {
            companyId,
            stockId: stock?.id || null,
            batchId: rmBatch.id,
            batchNo: rmBatch.batchNo,
            movementNo: generateDocNo('MOV'),
            movementType: 'JOB_WORK_MATERIAL_RETURN',
            sku: orderItem.product.sku,
            itemName: orderItem.product.name,
            warehouse: warehouse.name,
            quantity: qty,
            balanceAfter: (stock?.availableQty || 0) + (targetBucket === 'AVAILABLE' ? qty : 0),
            sourceBucket: 'WIP',
            destinationBucket: targetBucket,
            uom: orderItem.uom,
            unitCost: Number(rmBatch.unitCost) || 0.0,
            referenceType: 'JOB_WORK_RETURN',
            referenceNo: returnNo,
            notes: item.reason || 'Unused material returned from job worker',
            createdBy: actor.name || 'System',
          },
        });

        // 4. Create Material Return Record
        const record = await tx.jobWorkMaterialReturn.create({
          data: {
            companyId,
            returnNo,
            jobWorkOrderId: order.id,
            vendorId: order.vendorId,
            warehouseId: warehouse.id,
            productId: item.productId,
            rmBatchId: rmBatch.id,
            rmBatchNo: rmBatch.batchNo,
            sku: orderItem.product.sku,
            quantityReturned: qty,
            uom: orderItem.uom,
            reason: item.reason || 'Unconsumed raw material return',
            receivedById: actor.id || actor.userId || null,
          },
        });

        // 5. Update Order Item returnedQuantity
        await tx.jobWorkOrderItem.update({
          where: { id: orderItem.id },
          data: { returnedQuantity: { increment: qty } },
        });

        returnRecords.push(record);
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'JOB_WORK_MATERIAL_RETURN',
        serviceCode: 'manufacturing_production',
        moduleCode: 'job_work',
        details: `Recorded external material return of ${returnRecords.length} items from vendor ${order.vendor.name} on order ${order.orderNo}.`,
      });

      return returnRecords;
    });
  },

  async listMaterialReturns(companyId, orderId) {
    if (!companyId) throw jwError('Company ID is required.', 401);
    return prisma.jobWorkMaterialReturn.findMany({
      where: { companyId, jobWorkOrderId: orderId },
      orderBy: { returnedAt: 'desc' },
      include: { rmBatch: true },
    });
  },

  // ====================================================================
  // 7. EXTERNAL PRODUCTION MILESTONES
  // ====================================================================

  async addMilestone(companyId, orderId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);
    if (!data.milestoneType) throw jwError('Milestone type is required.');

    const ALLOWED_MILESTONES = [
      'MATERIAL_RECEIVED',
      'PRODUCTION_STARTED',
      'PROCESSING_COMPLETED',
      'PACKAGING_COMPLETED',
      'READY_FOR_DISPATCH',
    ];

    const milestoneType = String(data.milestoneType).trim().toUpperCase();
    if (!ALLOWED_MILESTONES.includes(milestoneType)) {
      throw jwError(`Invalid milestone type '${milestoneType}'. Allowed: ${ALLOWED_MILESTONES.join(', ')}.`, 400);
    }

    const order = await prisma.jobWorkOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw jwError('Job Work Order not found.', 404);

    const milestone = await prisma.jobWorkMilestone.create({
      data: {
        companyId,
        jobWorkOrderId: order.id,
        milestoneType,
        statusDate: new Date(data.statusDate || Date.now()),
        reportedOutputQty: data.reportedOutputQty !== undefined ? Number(data.reportedOutputQty) : null,
        reportedScrapQty: data.reportedScrapQty !== undefined ? Number(data.reportedScrapQty) : null,
        remarks: data.remarks || null,
        attachmentUri: data.attachmentUri || null,
        createdById: actor.id || actor.userId || null,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'System',
      action: 'JOB_WORK_MILESTONE_LOG',
      serviceCode: 'manufacturing_production',
      moduleCode: 'job_work',
      details: `Logged milestone ${milestoneType} for order ${order.orderNo}.`,
    });

    return milestone;
  },

  async listMilestones(companyId, orderId) {
    if (!companyId) throw jwError('Company ID is required.', 401);
    return prisma.jobWorkMilestone.findMany({
      where: { companyId, jobWorkOrderId: orderId },
      orderBy: { statusDate: 'asc' },
    });
  },

  // ====================================================================
  // 8. FINISHED GOODS RECEIPT & STRICT QUALITY_HOLD GATE
  // ====================================================================

  async createReceipt(companyId, orderId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);
    if (!data.warehouseId) throw jwError('Receiving warehouse ID is required.');

    const receivedQty = Number(data.receivedQty);
    if (!receivedQty || receivedQty <= 0) {
      throw jwError('Received quantity must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.jobWorkOrder.findFirst({
        where: { id: orderId, companyId },
        include: { outputProduct: true, vendor: true },
      });
      if (!order) throw jwError('Job Work Order not found.', 404);

      if (!['APPROVED', 'IN_PROGRESS'].includes(order.status)) {
        throw jwError(`Receipts can only be recorded for APPROVED or IN_PROGRESS orders. Current status: ${order.status}.`, 400);
      }

      const warehouse = await tx.inventoryWarehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });
      if (!warehouse) throw jwError('Receiving warehouse not found in active company.', 404);

      const receiptNo = String(data.receiptNo || generateDocNo('JWR')).trim().toUpperCase();
      const existingReceipt = await tx.jobWorkReceipt.findUnique({
        where: { companyId_receiptNo: { companyId, receiptNo } },
      });
      if (existingReceipt) throw jwError(`Receipt with number ${receiptNo} already exists.`, 409);

      // CRITICAL QC RULE: Finished goods land strictly in QUALITY_HOLD (never available initially)
      const batchNo = String(data.vendorBatchNo || generateDocNo('JWB')).trim().toUpperCase();

      const createdBatch = await tx.inventoryBatch.create({
        data: {
          companyId,
          productId: order.outputProductId,
          sku: order.outputProduct.sku,
          batchNo,
          warehouse: warehouse.name,
          manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : new Date(),
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          receivedDate: new Date(),
          vendorId: order.vendorId,
          vendorName: order.vendor.name,
          initialQty: receivedQty,
          availableQty: 0,
          qualityHoldQty: receivedQty,
          rejectedQty: 0,
          qualityStatus: 'PENDING_QC',
          status: 'ACTIVE',
          unitCost: Number(order.estimatedTotalCost) / Number(order.targetQuantity) || 0.0,
        },
      });

      // Update InventoryStock: Increment QUALITY_HOLD ONLY
      let stock = await tx.inventoryStock.findFirst({
        where: { companyId, productId: order.outputProductId, warehouse: warehouse.name },
      });

      if (stock) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: { qualityHoldQty: { increment: receivedQty } },
        });
      } else {
        stock = await tx.inventoryStock.create({
          data: {
            companyId,
            productId: order.outputProductId,
            sku: order.outputProduct.sku,
            name: order.outputProduct.name,
            warehouse: warehouse.name,
            stock: 0,
            availableQty: 0,
            qualityHoldQty: receivedQty,
            uom: order.uom,
          },
        });
      }

      // Record InventoryMovement
      await tx.inventoryMovement.create({
        data: {
          companyId,
          stockId: stock.id,
          batchId: createdBatch.id,
          batchNo: createdBatch.batchNo,
          movementNo: generateDocNo('MOV'),
          movementType: 'JOB_WORK_RECEIPT',
          sku: order.outputProduct.sku,
          itemName: order.outputProduct.name,
          warehouse: warehouse.name,
          quantity: receivedQty,
          balanceAfter: 0, // Available stock balance is unchanged (0 added to available)
          sourceBucket: null,
          destinationBucket: 'QUALITY_HOLD',
          uom: order.uom,
          unitCost: createdBatch.unitCost,
          referenceType: 'JOB_WORK_RECEIPT',
          referenceNo: receiptNo,
          notes: `External finished goods receipt from ${order.vendor.name}. Pending QC inspection.`,
          createdBy: actor.name || 'System',
        },
      });

      // Create JobWorkReceipt Record
      const receipt = await tx.jobWorkReceipt.create({
        data: {
          companyId,
          receiptNo,
          jobWorkOrderId: order.id,
          challanNo: data.challanNo || null,
          vendorDeliveryNote: data.vendorDeliveryNote || null,
          warehouseId: warehouse.id,
          receivedQty,
          acceptedQty: 0.0,
          rejectedQty: 0.0,
          uom: order.uom,
          vendorBatchNo: batchNo,
          createdInventoryBatchId: createdBatch.id,
          qcStatus: 'PENDING_QC',
          isRework: Boolean(data.isRework),
          receivedById: actor.id || actor.userId || null,
          receivedAt: new Date(),
        },
      });

      // Update Order receivedQuantity
      await tx.jobWorkOrder.update({
        where: { id: order.id },
        data: { receivedQuantity: { increment: receivedQty } },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'JOB_WORK_RECEIPT_CREATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'job_work',
        details: `Received ${receivedQty} ${order.uom} on receipt ${receipt.receiptNo} for order ${order.orderNo}. Held in QUALITY_HOLD pending inspection.`,
      });

      return tx.jobWorkReceipt.findUnique({
        where: { id: receipt.id },
        include: { warehouse: true, createdInventoryBatch: true, jobWorkOrder: true },
      });
    });
  },

  async listReceipts(companyId, query = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const where = { companyId };
    if (query.jobWorkOrderId) where.jobWorkOrderId = query.jobWorkOrderId;
    if (query.qcStatus) where.qcStatus = query.qcStatus;

    return prisma.jobWorkReceipt.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      include: {
        warehouse: { select: { id: true, name: true } },
        jobWorkOrder: { select: { id: true, orderNo: true, vendor: { select: { name: true } } } },
        createdInventoryBatch: true,
      },
    });
  },

  async getReceiptById(companyId, receiptId) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const receipt = await prisma.jobWorkReceipt.findFirst({
      where: { id: receiptId, companyId },
      include: {
        warehouse: true,
        createdInventoryBatch: true,
        jobWorkOrder: { include: { vendor: true, outputProduct: true } },
      },
    });
    if (!receipt) throw jwError('Receipt not found in active company.', 404);
    return receipt;
  },

  // ====================================================================
  // 9. INCOMING QC INSPECTION & RELEASE FROM QUALITY_HOLD
  // ====================================================================

  async inspectReceiptQc(companyId, receiptId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const acceptedQty = Number(data.acceptedQty || 0);
    const rejectedQty = Number(data.rejectedQty || 0);

    return prisma.$transaction(async (tx) => {
      const receipt = await tx.jobWorkReceipt.findFirst({
        where: { id: receiptId, companyId },
        include: {
          createdInventoryBatch: true,
          warehouse: true,
          jobWorkOrder: { include: { outputProduct: true } },
        },
      });
      if (!receipt) throw jwError('Job Work Receipt not found.', 404);

      if (receipt.qcStatus !== 'PENDING_QC') {
        throw jwError(`Receipt ${receipt.receiptNo} has already been inspected. Current status: ${receipt.qcStatus}.`, 400);
      }

      const totalReceived = Number(receipt.receivedQty);
      if (round4(acceptedQty + rejectedQty) !== round4(totalReceived)) {
        throw jwError(`Sum of accepted (${acceptedQty}) and rejected (${rejectedQty}) must equal total received (${totalReceived}).`, 400);
      }

      const batch = receipt.createdInventoryBatch;
      const warehouse = receipt.warehouse;

      // 1. Deduct receivedQty from QUALITY_HOLD on batch
      const batchUpdate = {
        qualityHoldQty: { decrement: totalReceived },
      };

      if (acceptedQty > 0) {
        batchUpdate.availableQty = { increment: acceptedQty };
      }
      if (rejectedQty > 0) {
        batchUpdate.rejectedQty = { increment: rejectedQty };
      }

      let newQualityStatus = 'ACCEPTED';
      if (rejectedQty === totalReceived) newQualityStatus = 'REJECTED';
      else if (rejectedQty > 0) newQualityStatus = 'PARTIAL';
      batchUpdate.qualityStatus = newQualityStatus;

      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: batchUpdate,
      });

      // 2. Update stock master
      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, productId: receipt.jobWorkOrder.outputProductId, warehouse: warehouse.name },
      });

      if (stock) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            qualityHoldQty: { decrement: totalReceived },
            ...(acceptedQty > 0 ? { availableQty: { increment: acceptedQty }, stock: { increment: acceptedQty } } : {}),
            ...(rejectedQty > 0 ? { rejectedQty: { increment: rejectedQty } } : {}),
          },
        });
      }

      // 3. Movement for QC Pass Release
      if (acceptedQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            companyId,
            stockId: stock?.id || null,
            batchId: batch.id,
            batchNo: batch.batchNo,
            movementNo: generateDocNo('MOV'),
            movementType: 'QC_PASS_RELEASE',
            sku: receipt.jobWorkOrder.outputProduct.sku,
            itemName: receipt.jobWorkOrder.outputProduct.name,
            warehouse: warehouse.name,
            quantity: acceptedQty,
            balanceAfter: (stock?.availableQty || 0) + acceptedQty,
            sourceBucket: 'QUALITY_HOLD',
            destinationBucket: 'AVAILABLE',
            uom: receipt.uom,
            unitCost: Number(batch.unitCost) || 0.0,
            referenceType: 'JOB_WORK_QC',
            referenceNo: receipt.receiptNo,
            notes: data.qcRemarks || 'QC PASSED: Released to available stock.',
            createdBy: actor.name || 'QC Inspector',
          },
        });
      }

      // 4. Movement for QC Rejection
      if (rejectedQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            companyId,
            stockId: stock?.id || null,
            batchId: batch.id,
            batchNo: batch.batchNo,
            movementNo: generateDocNo('MOV'),
            movementType: 'QC_REJECTION',
            sku: receipt.jobWorkOrder.outputProduct.sku,
            itemName: receipt.jobWorkOrder.outputProduct.name,
            warehouse: warehouse.name,
            quantity: rejectedQty,
            balanceAfter: stock?.availableQty || 0,
            sourceBucket: 'QUALITY_HOLD',
            destinationBucket: 'REJECTED',
            uom: receipt.uom,
            unitCost: Number(batch.unitCost) || 0.0,
            referenceType: 'JOB_WORK_QC',
            referenceNo: receipt.receiptNo,
            notes: data.qcRemarks || 'QC REJECTED: Moved to rejected quarantine.',
            createdBy: actor.name || 'QC Inspector',
          },
        });

        // Increment rejected quantity on order
        await tx.jobWorkOrder.update({
          where: { id: receipt.jobWorkOrderId },
          data: { rejectedQuantity: { increment: rejectedQty } },
        });
      }

      const qcStatus = acceptedQty === totalReceived ? 'PASSED' : (rejectedQty === totalReceived ? 'REJECTED' : 'PARTIALLY_PASSED');

      const updatedReceipt = await tx.jobWorkReceipt.update({
        where: { id: receipt.id },
        data: {
          qcStatus,
          acceptedQty,
          rejectedQty,
          qcRemarks: data.qcRemarks || null,
          qcInspectionId: data.qcInspectionId || null,
        },
        include: { createdInventoryBatch: true, warehouse: true },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'QC Inspector',
        action: 'JOB_WORK_QC_INSPECTION',
        serviceCode: 'manufacturing_production',
        moduleCode: 'job_work',
        details: `Completed QC inspection on receipt ${receipt.receiptNo}: ${acceptedQty} accepted, ${rejectedQty} rejected. Result: ${qcStatus}.`,
      });

      return updatedReceipt;
    });
  },

  // ====================================================================
  // 10. EXTERNAL REWORK & REINSPECTION
  // ====================================================================

  async createReworkRequest(companyId, receiptId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const reworkQty = Number(data.reworkQty);
    if (!reworkQty || reworkQty <= 0) {
      throw jwError('Rework quantity must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      const receipt = await tx.jobWorkReceipt.findFirst({
        where: { id: receiptId, companyId },
        include: { createdInventoryBatch: true, warehouse: true, jobWorkOrder: { include: { vendor: true, outputProduct: true } } },
      });
      if (!receipt) throw jwError('Receipt not found.', 404);

      if (reworkQty > Number(receipt.rejectedQty)) {
        throw jwError(`Rework quantity (${reworkQty}) cannot exceed rejected quantity (${receipt.rejectedQty}).`, 400);
      }

      const batch = receipt.createdInventoryBatch;
      const warehouse = receipt.warehouse;

      // Move from REJECTED bucket to WIP for external rework
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          rejectedQty: { decrement: reworkQty },
          wipQty: { increment: reworkQty },
        },
      });

      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, productId: receipt.jobWorkOrder.outputProductId, warehouse: warehouse.name },
      });
      if (stock) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            rejectedQty: { decrement: reworkQty },
            wipQty: { increment: reworkQty },
          },
        });
      }

      await tx.inventoryMovement.create({
        data: {
          companyId,
          stockId: stock?.id || null,
          batchId: batch.id,
          batchNo: batch.batchNo,
          movementNo: generateDocNo('MOV'),
          movementType: 'JOB_WORK_REWORK_DISPATCH',
          sku: receipt.jobWorkOrder.outputProduct.sku,
          itemName: receipt.jobWorkOrder.outputProduct.name,
          warehouse: warehouse.name,
          quantity: reworkQty,
          balanceAfter: stock?.availableQty || 0,
          sourceBucket: 'REJECTED',
          destinationBucket: 'WIP',
          uom: receipt.uom,
          unitCost: Number(batch.unitCost) || 0.0,
          referenceType: 'JOB_WORK_REWORK',
          referenceNo: receipt.receiptNo,
          notes: data.notes || `Dispatched rejected goods for vendor rework to ${receipt.jobWorkOrder.vendor.name}`,
          createdBy: actor.name || 'System',
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'JOB_WORK_REWORK_DISPATCH',
        serviceCode: 'manufacturing_production',
        moduleCode: 'job_work',
        details: `Dispatched ${reworkQty} ${receipt.uom} of rejected goods from receipt ${receipt.receiptNo} for vendor rework.`,
      });

      return {
        receiptId: receipt.id,
        reworkQuantity: reworkQty,
        status: 'DISPATCHED_FOR_REWORK',
        vendor: receipt.jobWorkOrder.vendor.name,
      };
    });
  },

  async receiveReworkedGoods(companyId, receiptId, data, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const reworkQty = Number(data.reworkQty);
    if (!reworkQty || reworkQty <= 0) {
      throw jwError('Reworked quantity must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      const receipt = await tx.jobWorkReceipt.findFirst({
        where: { id: receiptId, companyId },
        include: { createdInventoryBatch: true, warehouse: true, jobWorkOrder: { include: { outputProduct: true } } },
      });
      if (!receipt) throw jwError('Receipt not found.', 404);

      const batch = receipt.createdInventoryBatch;
      const warehouse = receipt.warehouse;

      // Move from WIP to QUALITY_HOLD for reinspection
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          wipQty: { decrement: reworkQty },
          qualityHoldQty: { increment: reworkQty },
        },
      });

      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, productId: receipt.jobWorkOrder.outputProductId, warehouse: warehouse.name },
      });
      if (stock) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            wipQty: { decrement: reworkQty },
            qualityHoldQty: { increment: reworkQty },
          },
        });
      }

      await tx.inventoryMovement.create({
        data: {
          companyId,
          stockId: stock?.id || null,
          batchId: batch.id,
          batchNo: batch.batchNo,
          movementNo: generateDocNo('MOV'),
          movementType: 'JOB_WORK_REWORK_RECEIPT',
          sku: receipt.jobWorkOrder.outputProduct.sku,
          itemName: receipt.jobWorkOrder.outputProduct.name,
          warehouse: warehouse.name,
          quantity: reworkQty,
          balanceAfter: stock?.availableQty || 0,
          sourceBucket: 'WIP',
          destinationBucket: 'QUALITY_HOLD',
          uom: receipt.uom,
          unitCost: Number(batch.unitCost) || 0.0,
          referenceType: 'JOB_WORK_REWORK',
          referenceNo: receipt.receiptNo,
          notes: 'Received reworked goods from vendor. Re-entered QUALITY_HOLD for reinspection.',
          createdBy: actor.name || 'System',
        },
      });

      return {
        receiptId: receipt.id,
        receivedReworkQty: reworkQty,
        status: 'HELD_FOR_REINSPECTION',
      };
    });
  },

  // ====================================================================
  // 11. MATERIAL RECONCILIATION ENGINE
  // ====================================================================

  async calculateReconciliationPreview(companyId, orderId, options = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const order = await prisma.jobWorkOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        outputProduct: true,
        bom: { include: { items: true } },
        items: { include: { product: true } },
        receipts: true,
        materialReturns: true,
        milestones: true,
      },
    });
    if (!order) throw jwError('Job Work Order not found.', 404);

    const totalAcceptedOutput = order.receipts.reduce((sum, r) => sum + Number(r.acceptedQty || 0), 0);
    const totalRejectedOutput = order.receipts.reduce((sum, r) => sum + Number(r.rejectedQty || 0), 0);
    const bomBatchSize = Number(order.bom.batchSize) || 1.0;

    let totalExcessWastageDebit = 0.0;
    const itemReconciliations = [];

    // Reported scrap from milestones (if any)
    const milestoneScrapSum = order.milestones.reduce((sum, m) => sum + Number(m.reportedScrapQty || 0), 0);
    const optionsItems = Array.isArray(options.items) ? options.items : [];

    for (const item of order.items) {
      const bomItem = order.bom.items.find((b) => b.productId === item.productId);
      const bQty = bomItem ? Number(bomItem.quantityPerBatch !== undefined ? bomItem.quantityPerBatch : bomItem.quantity) : 1.0;
      const stdPerUnit = bQty / bomBatchSize;

      const dispatchedQty = Number(item.dispatchedQuantity);
      const returnedQty = Number(item.returnedQuantity);

      // Consumed is theoretically based on accepted output * std requirement per unit, or explicitly reported
      const overrideItem = optionsItems.find((o) => o.productId === item.productId || o.sku === item.product.sku);
      const consumedQty = overrideItem?.consumedQty !== undefined ? Number(overrideItem.consumedQty) : round4(totalAcceptedOutput * stdPerUnit);
      if (consumedQty < 0) throw jwError(`Consumed quantity cannot be negative for ${item.product.sku}.`);

      // Actual scrap: must be independently reported and validated from vendor records/milestones (not assumed)
      const actualScrapQty = overrideItem?.actualScrapQty !== undefined ? Number(overrideItem.actualScrapQty) : (milestoneScrapSum > 0 ? milestoneScrapSum : 0.0);
      if (actualScrapQty < 0) throw jwError(`Actual scrap quantity cannot be negative for ${item.product.sku}.`);

      // Over-consumption validation: consumed material cannot exceed dispatched material
      if (consumedQty > dispatchedQty) {
        throw jwError(`Consumed quantity (${consumedQty} ${item.uom}) exceeds dispatched material (${dispatchedQty} ${item.uom}) for ${item.product.sku}.`, 400);
      }

      // Permissible scrap = Consumed * (Scrap Tolerance / 100)
      const permissibleScrapQty = round4(consumedQty * (Number(item.scrapTolerancePct) / 100));

      // Variance = Dispatched - Consumed - Returned - Actual Scrap
      const varianceQty = round4(dispatchedQty - consumedQty - returnedQty - actualScrapQty);

      // Excess scrap beyond permissible scrap: Excess Wastage Debit = MAX(0, Actual Scrap - Permissible Scrap) * Standard Material Cost
      const excessScrapQty = Math.max(0, round4(actualScrapQty - permissibleScrapQty));
      const unitCost = Number(item.standardUnitCost) > 0 ? Number(item.standardUnitCost) : Number(item.product?.purchasePrice || item.product?.costPrice || item.product?.sellingPrice || 0);
      const debitAmount = round2(excessScrapQty * unitCost);

      totalExcessWastageDebit += debitAmount;

      itemReconciliations.push({
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        uom: item.uom,
        dispatchedQty,
        consumedQty,
        returnedQty,
        permissibleScrapQty,
        actualScrapQty,
        excessScrapQty,
        varianceQty,
        unitCost,
        debitAmount,
      });
    }

    const conversionRate = Number(order.conversionRate) || 0.0;
    const grossJobWorkCharges = round2(totalAcceptedOutput * conversionRate);
    const rejectionDebit = Number(options.rejectionDebit) || 0.0;
    const netPayableToVendor = round2(Math.max(0, grossJobWorkCharges - totalExcessWastageDebit - rejectionDebit));

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      plannedOutputQty: Number(order.targetQuantity),
      actualOutputQty: totalAcceptedOutput,
      rejectedOutputQty: totalRejectedOutput,
      grossJobWorkCharges,
      excessWastageDebit: totalExcessWastageDebit,
      rejectionDebit,
      netPayableToVendor,
      hasExcessWastage: totalExcessWastageDebit > 0 || itemReconciliations.some((i) => i.varianceQty !== 0),
      items: itemReconciliations,
    };
  },

  async finalizeReconciliation(companyId, orderId, data = {}, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const preview = await this.calculateReconciliationPreview(companyId, orderId, data);

    return prisma.$transaction(async (tx) => {
      const order = await tx.jobWorkOrder.findFirst({
        where: { id: orderId, companyId },
        include: { vendor: true },
      });
      if (!order) throw jwError('Job Work Order not found.', 404);

      const reconciliationNo = String(data.reconciliationNo || generateDocNo('JWRN')).trim().toUpperCase();
      const existing = await tx.jobWorkReconciliation.findUnique({
        where: { companyId_reconciliationNo: { companyId, reconciliationNo } },
      });
      if (existing) throw jwError(`Reconciliation with number ${reconciliationNo} already exists.`, 409);

      const rejectionDebit = Number(data.rejectionDebit) || 0.0;
      const netPayable = round2(Math.max(0, preview.grossJobWorkCharges - preview.excessWastageDebit - rejectionDebit));
      const hasWastage = preview.excessWastageDebit > 0 || preview.items.some((i) => i.varianceQty !== 0);

      const isPaymentHold = data.isPaymentHold !== undefined ? Boolean(data.isPaymentHold) : hasWastage;
      const holdReason = isPaymentHold ? (data.holdReason || (hasWastage ? 'Excess material wastage requires management debit audit' : null)) : null;

      const rec = await tx.jobWorkReconciliation.create({
        data: {
          companyId,
          reconciliationNo,
          jobWorkOrderId: order.id,
          vendorId: order.vendorId,
          outputProductId: order.outputProductId,
          plannedOutputQty: preview.plannedOutputQty,
          actualOutputQty: preview.actualOutputQty,
          rejectedOutputQty: preview.rejectedOutputQty,
          grossJobWorkCharges: preview.grossJobWorkCharges,
          excessWastageDebit: preview.excessWastageDebit,
          rejectionDebit,
          netPayableToVendor: netPayable,
          settlementStatus: 'PENDING_AUDIT',
          isPaymentHold,
          holdReason,
          notes: data.notes || null,
        },
      });

      for (const item of preview.items) {
        await tx.jobWorkReconciliationItem.create({
          data: {
            companyId,
            reconciliationId: rec.id,
            productId: item.productId,
            sku: item.sku,
            dispatchedQty: item.dispatchedQty,
            consumedQty: item.consumedQty,
            returnedQty: item.returnedQty,
            permissibleScrapQty: item.permissibleScrapQty,
            actualScrapQty: item.actualScrapQty,
            varianceQty: item.varianceQty,
            unitCost: item.unitCost,
            debitAmount: item.debitAmount,
            uom: item.uom,
          },
        });
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'JOB_WORK_RECONCILIATION_FINALIZE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'job_work',
        details: `Finalized material reconciliation ${rec.reconciliationNo} for order ${order.orderNo}. Net Payable: ₹${rec.netPayableToVendor}. Payment Hold: ${isPaymentHold}.`,
      });

      return tx.jobWorkReconciliation.findUnique({
        where: { id: rec.id },
        include: { items: true, jobWorkOrder: true },
      });
    });
  },

  async listReconciliations(companyId, query = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const where = { companyId };
    if (query.jobWorkOrderId) where.jobWorkOrderId = query.jobWorkOrderId;
    if (query.settlementStatus) where.settlementStatus = query.settlementStatus;
    if (query.isPaymentHold !== undefined) where.isPaymentHold = query.isPaymentHold === 'true';

    return prisma.jobWorkReconciliation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        jobWorkOrder: { select: { id: true, orderNo: true, vendor: { select: { name: true } } } },
        _count: { select: { items: true } },
      },
    });
  },

  async getReconciliationById(companyId, reconciliationId) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const rec = await prisma.jobWorkReconciliation.findFirst({
      where: { id: reconciliationId, companyId },
      include: {
        jobWorkOrder: { include: { vendor: true, outputProduct: true } },
        items: { include: { product: true } },
      },
    });
    if (!rec) throw jwError('Reconciliation not found in active company.', 404);
    return rec;
  },

  // ====================================================================
  // 12. JOB WORK COSTING & VENDOR SETTLEMENT
  // ====================================================================

  async settleJobWork(companyId, reconciliationId, data = {}, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    return prisma.$transaction(async (tx) => {
      const rec = await tx.jobWorkReconciliation.findFirst({
        where: { id: reconciliationId, companyId },
        include: { jobWorkOrder: true },
      });
      if (!rec) throw jwError('Reconciliation record not found.', 404);

      if (rec.settlementStatus === 'SETTLED') {
        throw jwError(`Reconciliation ${rec.reconciliationNo} has already been settled.`, 400);
      }

      const updated = await tx.jobWorkReconciliation.update({
        where: { id: rec.id },
        data: {
          settlementStatus: 'SETTLED',
          isPaymentHold: false,
          holdReason: null,
          auditedById: actor.id || actor.userId || null,
          auditedAt: new Date(),
          notes: data.notes || rec.notes,
        },
      });

      // Update Order Status to COMPLETED
      await tx.jobWorkOrder.update({
        where: { id: rec.jobWorkOrderId },
        data: { status: 'COMPLETED' },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'JOB_WORK_SETTLEMENT_COMPLETE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'job_work',
        details: `Settled reconciliation ${rec.reconciliationNo} for order ${rec.jobWorkOrder.orderNo}. Order marked COMPLETED.`,
      });

      return updated;
    });
  },

  async togglePaymentHold(companyId, reconciliationId, { isPaymentHold, holdReason } = {}, actor = {}) {
    if (!companyId) throw jwError('Company ID is required.', 401);

    const rec = await prisma.jobWorkReconciliation.findFirst({
      where: { id: reconciliationId, companyId },
    });
    if (!rec) throw jwError('Reconciliation not found.', 404);

    const updated = await prisma.jobWorkReconciliation.update({
      where: { id: rec.id },
      data: {
        isPaymentHold: Boolean(isPaymentHold),
        holdReason: isPaymentHold ? (holdReason || 'Manual payment hold applied') : null,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'System',
      action: isPaymentHold ? 'JOB_WORK_PAYMENT_HOLD' : 'JOB_WORK_PAYMENT_RELEASE',
      serviceCode: 'manufacturing_production',
      moduleCode: 'job_work',
      details: `${isPaymentHold ? 'Applied' : 'Released'} payment hold on reconciliation ${rec.reconciliationNo}. Reason: ${holdReason || 'N/A'}.`,
    });

    return updated;
  },
};

export default jobWorkService;
