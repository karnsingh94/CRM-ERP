import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.js';
import { approvalService } from '../approval.service.js';
import { auditService } from '../audit.service.js';

function prodError(message, statusCode = 400, code = 'PRODUCTION_ERROR') {
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

function generateCode(prefix = 'MFG') {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${dateStr}-${rand}`;
}

const DEFAULT_PROCESS_STAGES = [
  { stepNumber: 1, stageName: 'Dispensing & Pre-Weighing', targetDuration: 30, targetTempC: 25.0 },
  { stepNumber: 2, stageName: 'Premixing & Dissolution', targetDuration: 45, targetTempC: 35.0 },
  { stepNumber: 3, stageName: 'Heating & Reaction Phase', targetDuration: 90, targetTempC: 75.0 },
  { stepNumber: 4, stageName: 'Homogenization & Agitation', targetDuration: 60, targetTempC: 60.0 },
  { stepNumber: 5, stageName: 'Controlled Cooling', targetDuration: 45, targetTempC: 30.0 },
  { stepNumber: 6, stageName: 'Filtration & Sifting', targetDuration: 30, targetTempC: 25.0 },
  { stepNumber: 7, stageName: 'Filling & Secondary Packaging', targetDuration: 60, targetTempC: 25.0 },
];

export const productionService = {
  // ====================================================================
  // 1. PRODUCTION PLANNING
  // ====================================================================

  async createPlan(companyId, data, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    if (!data.outputProductId) throw prodError('Output finished product ID is required.');
    if (!data.bomId) throw prodError('BOM ID is required.');
    const plannedQuantity = Number(data.plannedQuantity);
    if (!plannedQuantity || plannedQuantity <= 0) throw prodError('Planned quantity must be greater than zero.');

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: data.outputProductId, companyId } });
      if (!product) throw prodError('Output product not found in active company.', 404);

      const bom = await tx.bomMaster.findFirst({ where: { id: data.bomId, companyId } });
      if (!bom) throw prodError('BOM formula not found in active company.', 404);

      const planNo = String(data.planNo || generateCode('PP')).trim().toUpperCase();
      const existing = await tx.productionPlan.findUnique({ where: { companyId_planNo: { companyId, planNo } } });
      if (existing) throw prodError(`Production plan with number ${planNo} already exists.`, 409);

      const batchSize = Number(bom.batchSize) || 1.0;
      const plannedBatches = Math.ceil(plannedQuantity / batchSize);

      const plan = await tx.productionPlan.create({
        data: {
          companyId,
          planNo,
          planName: String(data.planName || `${product.name} Production Plan`).trim(),
          outputProductId: product.id,
          bomId: bom.id,
          plannedQuantity,
          plannedBatches: Number(data.plannedBatches) || plannedBatches,
          uom: String(data.uom || bom.uom || 'KG').toUpperCase(),
          priority: String(data.priority || 'MEDIUM').toUpperCase(),
          startDate: new Date(data.startDate || Date.now()),
          targetDate: new Date(data.targetDate || Date.now() + 7 * 86400000),
          status: 'DRAFT',
          notes: data.notes || null,
          createdById: actor.id || actor.userId || null,
        },
        include: { outputProduct: true, bom: true },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'PRODUCTION_PLAN_CREATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'production',
        details: `Created production plan ${plan.planNo} for ${plannedQuantity} ${plan.uom} of ${product.sku}.`,
      });

      return plan;
    });
  },

  async listPlans(companyId, query = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const where = { companyId };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.outputProductId) where.outputProductId = query.outputProductId;

    return prisma.productionPlan.findMany({
      where,
      include: {
        outputProduct: { select: { id: true, sku: true, name: true, uom: true } },
        bom: { select: { id: true, bomCode: true, version: true, standardCost: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getPlanById(companyId, planId) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const plan = await prisma.productionPlan.findFirst({
      where: { id: planId, companyId },
      include: {
        outputProduct: true,
        bom: { include: { items: { include: { product: true } } } },
        orders: { include: { outputProduct: true, batches: true } },
      },
    });
    if (!plan) throw prodError('Production plan not found.', 404);
    return plan;
  },

  // ====================================================================
  // 2. PRODUCTION ORDERS & MATERIAL REQUIREMENTS
  // ====================================================================

  async createOrder(companyId, data, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    if (!data.outputProductId) throw prodError('Output product ID is required.');
    if (!data.bomId) throw prodError('BOM ID is required.');
    const targetQuantity = Number(data.targetQuantity);
    if (!targetQuantity || targetQuantity <= 0) throw prodError('Target quantity must be greater than zero.');

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: data.outputProductId, companyId } });
      if (!product) throw prodError('Output product not found.', 404);

      // Verify BOM
      const bom = await tx.bomMaster.findFirst({
        where: { id: data.bomId, companyId },
        include: { items: { include: { product: true } } },
      });
      if (!bom) throw prodError('BOM formula not found.', 404);

      // Verify Sales Order linkage if provided
      if (data.salesOrderId) {
        const so = await tx.salesOrder.findFirst({ where: { id: data.salesOrderId, companyId } });
        if (!so) throw prodError('Referenced Sales Order not found.', 404);
      }

      const orderNo = String(data.orderNo || generateCode('PO-MFG')).trim().toUpperCase();
      const existing = await tx.productionOrder.findUnique({ where: { companyId_orderNo: { companyId, orderNo } } });
      if (existing) throw prodError(`Production order ${orderNo} already exists.`, 409);

      // Calculate material requirements based on target quantity / standard batch size
      const baseBatchSize = Number(bom.batchSize) || 1.0;
      const scaleFactor = targetQuantity / baseBatchSize;

      const preparedReqs = bom.items.map((item) => {
        const reqQty = round4(Number(item.quantityPerBatch) * scaleFactor);
        return {
          companyId,
          productId: item.productId,
          requiredQty: reqQty,
          reservedQty: 0.0,
          issuedQty: 0.0,
          consumedQty: 0.0,
          returnedQty: 0.0,
          uom: item.uom,
          status: 'PENDING',
        };
      });

      const order = await tx.productionOrder.create({
        data: {
          companyId,
          orderNo,
          planId: data.planId || null,
          salesOrderId: data.salesOrderId || null,
          outputProductId: product.id,
          bomId: bom.id,
          targetQuantity,
          producedQuantity: 0.0,
          rejectedQuantity: 0.0,
          uom: String(data.uom || bom.uom || 'KG').toUpperCase(),
          priority: String(data.priority || 'MEDIUM').toUpperCase(),
          status: 'DRAFT',
          scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
          scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
          notes: data.notes || null,
          createdById: actor.id || actor.userId || null,
          materialReqs: {
            create: preparedReqs,
          },
        },
        include: {
          outputProduct: true,
          bom: true,
          materialReqs: { include: { product: true } },
          salesOrder: true,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'PRODUCTION_ORDER_CREATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'production',
        details: `Created production order ${order.orderNo} for ${targetQuantity} ${order.uom} of ${product.sku} (BOM: ${bom.bomCode} v${bom.version}).`,
      });

      return order;
    });
  },

  async updateOrderStatus(companyId, orderId, newStatus, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const validStatuses = [
      'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'MATERIAL_PENDING',
      'READY_FOR_PRODUCTION', 'IN_PROGRESS', 'PARTIALLY_COMPLETED',
      'COMPLETED', 'ON_HOLD', 'CANCELLED'
    ];
    const upperStatus = String(newStatus).toUpperCase();
    if (!validStatuses.includes(upperStatus)) {
      throw prodError(`Invalid production order status ${newStatus}. Valid statuses: ${validStatuses.join(', ')}`);
    }

    const order = await prisma.productionOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw prodError('Production order not found.', 404);

    const updated = await prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        status: upperStatus,
        approvedById: upperStatus === 'APPROVED' ? (actor.id || actor.userId || null) : order.approvedById,
        actualStart: upperStatus === 'IN_PROGRESS' && !order.actualStart ? new Date() : order.actualStart,
        actualEnd: upperStatus === 'COMPLETED' ? new Date() : order.actualEnd,
      },
      include: { outputProduct: true, bom: true, materialReqs: true },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'System',
      action: 'PRODUCTION_ORDER_STATUS_CHANGE',
      serviceCode: 'manufacturing_production',
      moduleCode: 'production',
      details: `Changed status of production order ${order.orderNo} from ${order.status} to ${upperStatus}.`,
    });

    return updated;
  },

  async listOrders(companyId, query = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const where = { companyId };
    if (query.status) where.status = query.status;
    if (query.outputProductId) where.outputProductId = query.outputProductId;
    if (query.salesOrderId) where.salesOrderId = query.salesOrderId;
    if (query.priority) where.priority = query.priority;

    return prisma.productionOrder.findMany({
      where,
      include: {
        outputProduct: { select: { id: true, sku: true, name: true, uom: true } },
        bom: { select: { id: true, bomCode: true, version: true, standardCost: true } },
        salesOrder: { select: { id: true, orderNo: true, amount: true } },
        _count: { select: { materialReqs: true, batches: true, dprs: true, qcInspections: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getOrderById(companyId, orderId) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const order = await prisma.productionOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        outputProduct: true,
        bom: { include: { items: { include: { product: true } } } },
        salesOrder: true,
        plan: true,
        materialReqs: { include: { product: true } },
        batches: { include: { steps: true, qcInspections: true, materials: true } },
        dprs: true,
        qcInspections: true,
      },
    });
    if (!order) throw prodError('Production order not found.', 404);
    return order;
  },

  /**
   * Check material availability against inventory stocks for a production order
   */
  async checkMaterialAvailability(companyId, orderId) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const order = await prisma.productionOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        materialReqs: { include: { product: true } },
      },
    });
    if (!order) throw prodError('Production order not found.', 404);

    let allAvailable = true;
    const checks = [];

    for (const req of order.materialReqs) {
      const stock = await prisma.inventoryStock.findFirst({
        where: {
          companyId,
          OR: [
            { productId: req.productId },
            { sku: req.product.sku },
          ],
        },
      });

      const availableQty = stock ? Number(stock.availableQty || 0) : 0;
      const requiredQty = Number(req.requiredQty);
      const remainingNeeded = Math.max(0, requiredQty - Number(req.issuedQty));
      const isShortage = availableQty < remainingNeeded;

      if (isShortage) allAvailable = false;

      checks.push({
        requirementId: req.id,
        productId: req.productId,
        sku: req.product.sku,
        name: req.product.name,
        uom: req.uom,
        requiredQty,
        issuedQty: Number(req.issuedQty),
        remainingNeeded,
        availableInStock: availableQty,
        shortageQty: Math.max(0, remainingNeeded - availableQty),
        isAvailable: !isShortage,
      });
    }

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      allMaterialsAvailable: allAvailable,
      hasShortage: !allAvailable,
      status: allAvailable ? 'READY_TO_ISSUE' : 'SHORTAGE_DETECTED',
      components: checks,
      requirements: checks,
    };
  },

  // ====================================================================
  // 3. FIFO RAW MATERIAL ISSUE & WIP INTEGRATION
  // ====================================================================

  /**
   * Issue raw materials for a production order using strict FIFO from AVAILABLE bucket to WIP bucket
   */
  async issueMaterialsFIFO(companyId, orderId, { batchId = null } = {}, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);

    return prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id: orderId, companyId },
        include: { materialReqs: { include: { product: true } } },
      });
      if (!order) throw prodError('Production order not found.', 404);

      let targetBatch = null;
      if (batchId) {
        targetBatch = await tx.manufacturingBatch.findFirst({
          where: { id: batchId, companyId, orderId },
        });
        if (!targetBatch) throw prodError('Target manufacturing batch not found.', 404);
      }

      const issueRecords = [];

      for (const req of order.materialReqs) {
        const remainingNeeded = round4(Number(req.requiredQty) - Number(req.issuedQty));
        if (remainingNeeded <= 0) continue; // Already fully issued

        // 1. Query active, non-expired batches for this product in AVAILABLE bucket (FIFO order)
        const eligibleBatches = await tx.inventoryBatch.findMany({
          where: {
            companyId,
            OR: [
              { productId: req.productId },
              { sku: req.product.sku },
            ],
            status: 'ACTIVE',
            qualityStatus: 'ACCEPTED',
            availableQty: { gt: 0 },
          },
          orderBy: [
            { manufacturingDate: 'asc' },
            { receivedDate: 'asc' },
          ],
        });

        const totalAvailable = eligibleBatches.reduce((sum, b) => sum + Number(b.availableQty || 0), 0);
        if (totalAvailable < remainingNeeded) {
          throw prodError(
            `Insufficient eligible stock for component ${req.product.sku}. Needed: ${remainingNeeded} ${req.uom}, Available in FIFO lots: ${totalAvailable} ${req.uom}. (Quality Hold and Rejected lots excluded).`,
            409
          );
        }

        let needed = remainingNeeded;
        let issuedForThisReq = 0;

        for (const lot of eligibleBatches) {
          if (needed <= 0) break;
          const take = Math.min(needed, Number(lot.availableQty));
          needed = round4(needed - take);
          issuedForThisReq = round4(issuedForThisReq + take);

          // A. Decrement AVAILABLE, increment WIP on lot
          await tx.inventoryBatch.update({
            where: { id: lot.id },
            data: {
              availableQty: { decrement: take },
              wipQty: { increment: take },
            },
          });

          // B. Decrement AVAILABLE, increment WIP on inventory stock master
          const stock = await tx.inventoryStock.findFirst({
            where: { companyId, productId: req.productId },
          });
          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                availableQty: { decrement: take },
                wipQty: { increment: take },
              },
            });
          }

          // C. Record InventoryMovement (AUDIT LEDGER)
          const movementNo = generateCode('MOV');
          const movement = await tx.inventoryMovement.create({
            data: {
              companyId,
              stockId: stock ? stock.id : null,
              movementNo,
              movementType: 'MANUFACTURING_ISSUE',
              sku: req.product.sku,
              itemName: req.product.name,
              warehouse: lot.warehouse || 'Main Warehouse',
              quantity: take,
              balanceAfter: stock ? (stock.stock || 0) : 0,
              uom: req.uom,
              sourceBucket: 'AVAILABLE',
              destinationBucket: 'WIP',
              referenceType: 'PRODUCTION_ORDER',
              referenceId: order.id,
              referenceNo: order.orderNo,
              batchId: lot.id,
              batchNo: lot.batchNo,
              reason: `FIFO material issue for Production Order ${order.orderNo}`,
              createdBy: actor.name || 'Storekeeper',
            },
          });

          // D. Record relational genealogy item if batchId is provided
          if (targetBatch) {
            await tx.manufacturingBatchMaterial.create({
              data: {
                companyId,
                batchId: targetBatch.id,
                rmBatchId: lot.id,
                productId: req.productId,
                movementId: movement.id,
                sku: req.product.sku,
                rmBatchNo: lot.batchNo,
                issuedQty: take,
                consumedQty: 0.0,
                returnedQty: 0.0,
                uom: req.uom,
                unitCost: lot.unitCost || 0.0,
                issuedAt: new Date(),
                issuedById: actor.id || actor.userId || null,
              },
            });
          }

          issueRecords.push({
            sku: req.product.sku,
            batchNo: lot.batchNo,
            quantityIssued: take,
            sourceBucket: 'AVAILABLE',
            destinationBucket: 'WIP',
          });
        }

        // Update requirement record
        const newIssuedTotal = round4(Number(req.issuedQty) + issuedForThisReq);
        await tx.productionMaterialRequirement.update({
          where: { id: req.id },
          data: {
            issuedQty: newIssuedTotal,
            status: newIssuedTotal >= Number(req.requiredQty) ? 'FULLY_ISSUED' : 'PARTIALLY_ISSUED',
          },
        });
      }

      // Update Order Status to READY_FOR_PRODUCTION or IN_PROGRESS
      await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'READY_FOR_PRODUCTION',
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'MANUFACTURING_MATERIAL_ISSUE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'production',
        details: `Issued ${issueRecords.length} material lots to WIP for Production Order ${order.orderNo}.`,
      });

      return {
        success: true,
        orderId,
        orderNo: order.orderNo,
        status: 'READY_FOR_PRODUCTION',
        issuedComponentsCount: issueRecords.length,
        issueRecords,
      };
    });
  },

  /**
   * Return unused raw materials from WIP back to AVAILABLE
   */
  async returnUnusedMaterial(companyId, data, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const { orderId, rmBatchId, quantity, reason } = data;
    const returnQty = Number(quantity);
    if (!returnQty || returnQty <= 0) throw prodError('Return quantity must be greater than zero.');

    return prisma.$transaction(async (tx) => {
      const lot = await tx.inventoryBatch.findFirst({
        where: { id: rmBatchId, companyId },
        include: { product: true },
      });
      if (!lot) throw prodError('Raw material batch lot not found.', 404);
      if (Number(lot.wipQty || 0) < returnQty) {
        throw prodError(`Cannot return ${returnQty} units: only ${lot.wipQty || 0} units currently in WIP for this batch.`);
      }

      // 1. Decrement WIP, increment AVAILABLE on batch lot
      await tx.inventoryBatch.update({
        where: { id: lot.id },
        data: {
          wipQty: { decrement: returnQty },
          availableQty: { increment: returnQty },
        },
      });

      // 2. Decrement WIP, increment AVAILABLE on inventory stock master
      const stock = await tx.inventoryStock.findFirst({
        where: { companyId, productId: lot.productId },
      });
      if (stock) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            wipQty: { decrement: returnQty },
            availableQty: { increment: returnQty },
          },
        });
      }

      // 3. Log movement
      const movement = await tx.inventoryMovement.create({
        data: {
          companyId,
          stockId: stock ? stock.id : null,
          movementNo: generateCode('MOV'),
          movementType: 'MANUFACTURING_RETURN',
          sku: lot.sku,
          itemName: lot.product ? lot.product.name : lot.sku,
          warehouse: lot.warehouse,
          quantity: returnQty,
          balanceAfter: stock ? stock.stock : 0,
          uom: 'KG',
          sourceBucket: 'WIP',
          destinationBucket: 'AVAILABLE',
          referenceType: 'PRODUCTION_ORDER',
          referenceId: orderId || null,
          batchId: lot.id,
          batchNo: lot.batchNo,
          reason: reason || 'Return of unused shopfloor raw materials from WIP back to Available',
          createdBy: actor.name || 'Storekeeper',
        },
      });

      // 4. Update genealogy record if exists
      if (data.batchMaterialId) {
        await tx.manufacturingBatchMaterial.update({
          where: { id: data.batchMaterialId },
          data: { returnedQty: { increment: returnQty } },
        });
      }

      return { success: true, returnedQty: returnQty, movementNo: movement.movementNo };
    });
  },

  // ====================================================================
  // 4. MANUFACTURING BATCHES & 2-WAY GENEALOGY
  // ====================================================================

  async createBatch(companyId, orderId, data = {}, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);

    return prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id: orderId, companyId },
        include: { outputProduct: true },
      });
      if (!order) throw prodError('Production order not found.', 404);

      const batchNo = String(data.batchNo || generateCode('MFG')).trim().toUpperCase();
      const existing = await tx.manufacturingBatch.findUnique({
        where: { companyId_batchNo: { companyId, batchNo } },
      });
      if (existing) throw prodError(`Manufacturing batch ${batchNo} already exists.`, 409);

      const batchQty = Number(data.batchQuantity) > 0 ? Number(data.batchQuantity) : Number(order.targetQuantity);

      // Create batch
      const batch = await tx.manufacturingBatch.create({
        data: {
          companyId,
          batchNo,
          orderId: order.id,
          outputProductId: order.outputProductId,
          batchQuantity: batchQty,
          actualOutputQty: 0.0,
          wastageQty: 0.0,
          uom: order.uom,
          machineName: data.machineName || 'Mixing Line 1',
          shift: data.shift || 'Shift A',
          supervisorName: data.supervisorName || actor.name || 'Production Supervisor',
          status: 'PLANNED',
          mfgDate: data.mfgDate ? new Date(data.mfgDate) : new Date(),
          expDate: data.expDate ? new Date(data.expDate) : new Date(Date.now() + 365 * 86400000),
          startedAt: new Date(),
          steps: {
            create: DEFAULT_PROCESS_STAGES.map((s) => ({
              companyId,
              stepNumber: s.stepNumber,
              stageName: s.stageName,
              targetDuration: s.targetDuration,
              targetTempC: s.targetTempC,
              status: 'PENDING',
            })),
          },
        },
        include: {
          steps: true,
          outputProduct: true,
          order: true,
        },
      });

      // Update Order status to IN_PROGRESS
      await tx.productionOrder.update({
        where: { id: order.id },
        data: { status: 'IN_PROGRESS', actualStart: order.actualStart || new Date() },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'MANUFACTURING_BATCH_CREATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'production',
        details: `Created manufacturing batch ${batch.batchNo} for ${batchQty} ${batch.uom} of ${order.outputProduct.sku}.`,
      });

      return batch;
    });
  },

  /**
   * Get 2-way batch genealogy
   */
  async getBatchGenealogy(companyId, batchId) {
    if (!companyId) throw prodError('Company ID is required.', 401);

    const batch = await prisma.manufacturingBatch.findFirst({
      where: { id: batchId, companyId },
      include: {
        outputProduct: true,
        order: { include: { bom: true } },
        materials: {
          include: {
            rmBatch: true,
            product: true,
            movement: true,
          },
        },
        steps: { orderBy: { stepNumber: 'asc' } },
        qcInspections: true,
        reprocessings: true,
      },
    });
    if (!batch) throw prodError('Manufacturing batch not found.', 404);

    return {
      batchDetails: {
        id: batch.id,
        batchNo: batch.batchNo,
        outputProduct: {
          id: batch.outputProduct.id,
          sku: batch.outputProduct.sku,
          name: batch.outputProduct.name,
          category: batch.outputProduct.category,
        },
        batchQuantity: Number(batch.batchQuantity),
        actualOutputQty: Number(batch.actualOutputQty),
        wastageQty: Number(batch.wastageQty),
        status: batch.status,
        mfgDate: batch.mfgDate,
        expDate: batch.expDate,
        machineName: batch.machineName,
        shift: batch.shift,
        supervisorName: batch.supervisorName,
      },
      // Backward Traceability (FG -> Raw Materials)
      consumedRawMaterials: batch.materials.map((m) => ({
        materialGenealogyId: m.id,
        sku: m.sku,
        name: m.product.name,
        rmBatchId: m.rmBatchId,
        rmBatchNo: m.rmBatchNo,
        vendorName: m.rmBatch.vendorName || 'Direct Inward',
        vendorGrnNo: m.rmBatch.grnNo || 'N/A',
        issuedQty: Number(m.issuedQty),
        consumedQty: Number(m.consumedQty),
        returnedQty: Number(m.returnedQty),
        uom: m.uom,
        unitCost: Number(m.unitCost),
        movementNo: m.movement ? m.movement.movementNo : null,
        issuedAt: m.issuedAt,
      })),
      rawMaterials: batch.materials.map((m) => ({
        id: m.id,
        sku: m.sku,
        name: m.product.name,
        rmBatchId: m.rmBatchId,
        rmBatchNo: m.rmBatchNo,
        vendorName: m.rmBatch.vendorName || 'Direct Inward',
        issuedQty: Number(m.issuedQty),
        consumedQty: Number(m.consumedQty),
        returnedQty: Number(m.returnedQty),
        uom: m.uom,
      })),
      processStages: batch.steps,
      qualityInspections: batch.qcInspections,
      reworkHistory: batch.reprocessings,
    };
  },

  /**
   * Forward Traceability: Find all FG batches that consumed a specific RM batch
   */
  async traceRawMaterialForward(companyId, rmBatchId) {
    if (!companyId) throw prodError('Company ID is required.', 401);

    const usages = await prisma.manufacturingBatchMaterial.findMany({
      where: { companyId, rmBatchId },
      include: {
        manufacturingBatch: {
          include: { outputProduct: true, order: true },
        },
        rmBatch: true,
      },
    });

    return {
      rmBatchId,
      totalUsagesCount: usages.length,
      affectedBatches: usages.map((u) => ({
        mfgBatchId: u.manufacturingBatch.id,
        mfgBatchNo: u.manufacturingBatch.batchNo,
        batchNo: u.manufacturingBatch.batchNo,
        batchNumber: u.manufacturingBatch.batchNo,
        orderNo: u.manufacturingBatch.order.orderNo,
        outputProductSku: u.manufacturingBatch.outputProduct.sku,
        outputProductName: u.manufacturingBatch.outputProduct.name,
        quantityUsed: Number(u.issuedQty),
        uom: u.uom,
        status: u.manufacturingBatch.status,
        mfgDate: u.manufacturingBatch.mfgDate,
      })),
      manufacturingBatches: usages.map((u) => ({
        id: u.manufacturingBatch.id,
        batchNo: u.manufacturingBatch.batchNo,
        batchNumber: u.manufacturingBatch.batchNo,
        orderNo: u.manufacturingBatch.order.orderNo,
        outputProductSku: u.manufacturingBatch.outputProduct.sku,
        outputProductName: u.manufacturingBatch.outputProduct.name,
        quantityUsed: Number(u.issuedQty),
        uom: u.uom,
        status: u.manufacturingBatch.status,
        mfgDate: u.manufacturingBatch.mfgDate,
      })),
    };
  },

  // ====================================================================
  // 5. SEQUENTIAL MIXING PROCESS STAGES & COMPLETION GATES
  // ====================================================================

  async completeProcessStep(companyId, batchId, stepNumber, data = {}, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const stepNum = Number(stepNumber);
    if (!stepNum || stepNum < 1) throw prodError('Valid step number is required.');

    return prisma.$transaction(async (tx) => {
      const batch = await tx.manufacturingBatch.findFirst({
        where: { id: batchId, companyId },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
      if (!batch) throw prodError('Manufacturing batch not found.', 404);

      const targetStep = batch.steps.find((s) => s.stepNumber === stepNum);
      if (!targetStep) throw prodError(`Process stage #${stepNum} does not exist in this batch sequence.`, 404);

      // MANDATORY COMPLETION GATE: Preceding step (stepNum - 1) must be COMPLETED
      if (stepNum > 1) {
        const prevStep = batch.steps.find((s) => s.stepNumber === stepNum - 1);
        if (!prevStep || prevStep.status !== 'COMPLETED') {
          throw prodError(
            `MANDATORY STAGE GATE ENFORCEMENT: Cannot advance to Step ${stepNum} (${targetStep.stageName}) until Step ${stepNum - 1} (${prevStep?.stageName || 'Previous'}) is verified and COMPLETED.`,
            409,
            'SEQUENTIAL_GATE_VIOLATION'
          );
        }
      }

      // Update current step
      const updatedStep = await tx.manufacturingProcessStep.update({
        where: { id: targetStep.id },
        data: {
          status: 'COMPLETED',
          actualDuration: Number(data.actualDuration) || targetStep.targetDuration,
          actualTempC: data.actualTempC ? Number(data.actualTempC) : targetStep.targetTempC,
          operatorName: data.operatorName || actor.name || 'Shift Operator',
          notes: data.notes || null,
          verifiedAt: new Date(),
          verifiedById: actor.id || actor.userId || null,
        },
      });

      // If this is the last step in sequence, update batch status to QC_PENDING
      const isLastStep = stepNum === batch.steps.length;
      if (isLastStep) {
        await tx.manufacturingBatch.update({
          where: { id: batchId },
          data: { status: 'QC_PENDING' },
        });
      } else {
        await tx.manufacturingBatch.update({
          where: { id: batchId },
          data: { status: 'IN_MIXING' },
        });
      }

      return {
        success: true,
        batchId,
        stepNumber: stepNum,
        stageName: targetStep.stageName,
        status: 'COMPLETED',
        isSequenceCompleted: isLastStep,
      };
    });
  },

  // ====================================================================
  // 6. DAILY PRODUCTION REPORTS (DPR)
  // ====================================================================

  async createDpr(companyId, data, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const plannedQty = Number(data.plannedQty);
    const actualQty = Number(data.actualQty);
    if (isNaN(plannedQty) || plannedQty <= 0) throw prodError('Planned quantity must be greater than zero.');
    if (isNaN(actualQty) || actualQty < 0) throw prodError('Actual quantity cannot be negative.');

    const dprNo = String(data.dprNo || generateCode('DPR')).trim().toUpperCase();
    const existing = await prisma.dailyProductionReport.findUnique({
      where: { companyId_dprNo: { companyId, dprNo } },
    });
    if (existing) throw prodError(`DPR ${dprNo} already exists.`, 409);

    const wastageQty = Number(data.wastageQty) >= 0 ? Number(data.wastageQty) : 0.0;
    const efficiencyPct = plannedQty > 0 ? round2((actualQty / plannedQty) * 100) : 0.0;

    const dpr = await prisma.dailyProductionReport.create({
      data: {
        companyId,
        dprNo,
        dprDate: data.dprDate ? new Date(data.dprDate) : new Date(),
        shift: data.shift || 'Shift A',
        orderId: data.orderId || null,
        machineName: data.machineName || 'Mixing Line 1',
        plannedQty,
        actualQty,
        wastageQty,
        efficiencyPct,
        downtimeMinutes: Number(data.downtimeMinutes) || 0,
        downtimeReason: data.downtimeReason || null,
        supervisorName: data.supervisorName || actor.name || 'Shift Supervisor',
        isVerified: Boolean(data.isVerified),
        verifiedById: data.isVerified ? (actor.id || actor.userId) : null,
        verifiedAt: data.isVerified ? new Date() : null,
        notes: data.notes || null,
      },
      include: { order: true },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'System',
      action: 'DPR_CREATE',
      serviceCode: 'manufacturing_production',
      moduleCode: 'production',
      details: `Logged DPR ${dpr.dprNo} for shift ${dpr.shift} (Actual: ${actualQty}, Efficiency: ${efficiencyPct}%).`,
    });

    return dpr;
  },

  async listDprs(companyId, query = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const where = { companyId };
    if (query.shift) where.shift = query.shift;
    if (query.orderId) where.orderId = query.orderId;
    if (query.date) {
      const d = new Date(query.date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      where.dprDate = { gte: start, lte: end };
    }

    return prisma.dailyProductionReport.findMany({
      where,
      include: {
        order: { select: { id: true, orderNo: true, outputProduct: true } },
      },
      orderBy: { dprDate: 'desc' },
    });
  },

  // ====================================================================
  // 7. MANUFACTURING QUALITY CONTROL (QC)
  // ====================================================================

  async createQcInspection(companyId, data, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    if (!data.batchId) throw prodError('Manufacturing batch ID is required.');
    const testedQty = Number(data.testedQty);
    if (!testedQty || testedQty <= 0) throw prodError('Tested quantity must be greater than zero.');

    return prisma.$transaction(async (tx) => {
      const batch = await tx.manufacturingBatch.findFirst({
        where: { id: data.batchId, companyId },
        include: { outputProduct: true, order: true },
      });
      if (!batch) throw prodError('Manufacturing batch not found.', 404);

      const qcNo = String(data.qcNo || generateCode('QC-MFG')).trim().toUpperCase();
      const existing = await tx.manufacturingQC.findUnique({
        where: { companyId_qcNo: { companyId, qcNo } },
      });
      if (existing) throw prodError(`QC inspection ${qcNo} already exists.`, 409);

      const passedQty = Number(data.passedQty) || 0.0;
      const rejectedQty = Number(data.rejectedQty) || 0.0;
      const status = String(data.status || (passedQty >= testedQty ? 'PASSED' : 'FAILED')).toUpperCase();

      let disposition = data.disposition;
      if (!disposition) {
        if (status === 'PASSED') disposition = 'RELEASE_TO_AVAILABLE';
        else if (status === 'QUALITY_HOLD') disposition = 'HOLD_IN_QUALITY';
        else disposition = 'REJECT_FOR_REWORK';
      }

      const qc = await tx.manufacturingQC.create({
        data: {
          companyId,
          qcNo,
          qcType: data.qcType || 'FINISHED_GOODS',
          orderId: batch.orderId,
          batchId: batch.id,
          productId: batch.outputProductId,
          testedQty,
          passedQty,
          rejectedQty,
          parameterResults: data.parameterResults || null,
          status,
          disposition,
          inspectorName: data.inspectorName || actor.name || 'Quality Officer',
          testedAt: new Date(),
          remarks: data.remarks || null,
        },
        include: { batch: true, product: true },
      });

      // Update batch status based on QC disposition
      let batchStatus = 'QC_PENDING';
      if (status === 'PASSED') batchStatus = 'QC_PASSED';
      else if (status === 'QUALITY_HOLD') batchStatus = 'QUALITY_HOLD';
      else if (status === 'FAILED') batchStatus = 'REJECTED';

      await tx.manufacturingBatch.update({
        where: { id: batch.id },
        data: { status: batchStatus },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'MANUFACTURING_QC_LOG',
        serviceCode: 'manufacturing_production',
        moduleCode: 'qc',
        details: `Logged QC inspection ${qc.qcNo} for batch ${batch.batchNo}. Status: ${status}, Disposition: ${disposition}.`,
      });

      return qc;
    });
  },

  async listQcInspections(companyId, query = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    const where = { companyId };
    if (query.status) where.status = query.status;
    if (query.batchId) where.batchId = query.batchId;
    if (query.productId) where.productId = query.productId;

    return prisma.manufacturingQC.findMany({
      where,
      include: {
        batch: { select: { id: true, batchNo: true, order: true } },
        product: { select: { id: true, sku: true, name: true, uom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ====================================================================
  // 8. FINISHED GOODS RECEIPT INTO AVAILABLE INVENTORY
  // ====================================================================

  /**
   * Receive finished goods from an approved/passed batch into AVAILABLE stock bucket
   */
  async receiveFinishedGoods(companyId, batchId, data = {}, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);

    return prisma.$transaction(async (tx) => {
      const batch = await tx.manufacturingBatch.findFirst({
        where: { id: batchId, companyId },
        include: {
          outputProduct: true,
          order: true,
          qcInspections: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!batch) throw prodError('Manufacturing batch not found.', 404);

      if (batch.status === 'COMPLETED') {
        throw prodError(`Finished goods for batch ${batch.batchNo} have already been received into inventory.`, 409);
      }

      // ENFORCE QC APPROVAL GATE
      const latestQc = batch.qcInspections[0];
      if (!latestQc || latestQc.status !== 'PASSED') {
        throw prodError(
          `QUALITY CONTROL GATE: Cannot receive finished goods for batch ${batch.batchNo}. Quality inspection must be PASSED. Current QC status: ${latestQc?.status || 'NO_QC_RECORD'}.`,
          403,
          'QC_GATE_REJECTED'
        );
      }

      const outputQty = Number(data.actualOutputQty) > 0 ? Number(data.actualOutputQty) : Number(latestQc.passedQty || batch.batchQuantity);
      const wastageQty = Number(batch.batchQuantity) > outputQty ? round4(Number(batch.batchQuantity) - outputQty) : 0.0;
      const warehouse = data.warehouse || 'Main Warehouse';

      // 1. Create or increment Finished Goods InventoryBatch
      const existingFgBatch = await tx.inventoryBatch.findFirst({
        where: { companyId, sku: batch.outputProduct.sku, batchNo: batch.batchNo, warehouse },
      });

      let fgBatch;
      if (existingFgBatch) {
        fgBatch = await tx.inventoryBatch.update({
          where: { id: existingFgBatch.id },
          data: {
            availableQty: { increment: outputQty },
          },
        });
      } else {
        fgBatch = await tx.inventoryBatch.create({
          data: {
            companyId,
            productId: batch.outputProductId,
            sku: batch.outputProduct.sku,
            batchNo: batch.batchNo,
            warehouse,
            manufacturingDate: batch.mfgDate || new Date(),
            expiryDate: batch.expDate,
            initialQty: outputQty,
            availableQty: outputQty,
            qualityStatus: 'ACCEPTED',
            status: 'ACTIVE',
            unitCost: Number(data.unitCost) || 0.0,
          },
        });
      }

      // 2. Increment stock master in AVAILABLE bucket
      let stock = await tx.inventoryStock.findFirst({
        where: { companyId, productId: batch.outputProductId },
      });
      if (stock) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            stock: { increment: outputQty },
            availableQty: { increment: outputQty },
          },
        });
      } else {
        stock = await tx.inventoryStock.create({
          data: {
            companyId,
            productId: batch.outputProductId,
            sku: batch.outputProduct.sku,
            name: batch.outputProduct.name,
            warehouse,
            stock: outputQty,
            availableQty: outputQty,
            uom: batch.uom,
          },
        });
      }

      // 3. Log movement in central movement ledger
      const movement = await tx.inventoryMovement.create({
        data: {
          companyId,
          stockId: stock.id,
          movementNo: generateCode('MOV'),
          movementType: 'MANUFACTURING_RECEIPT',
          sku: batch.outputProduct.sku,
          itemName: batch.outputProduct.name,
          warehouse,
          quantity: outputQty,
          balanceAfter: stock.stock + outputQty,
          uom: batch.uom,
          sourceBucket: null,
          destinationBucket: 'AVAILABLE',
          referenceType: 'MANUFACTURING_BATCH',
          referenceId: batch.id,
          referenceNo: batch.batchNo,
          batchId: fgBatch.id,
          batchNo: batch.batchNo,
          reason: `Finished goods inward receipt from Manufacturing Batch ${batch.batchNo}`,
          createdBy: actor.name || 'Storekeeper',
        },
      });

      // 4. Mark batch as COMPLETED
      await tx.manufacturingBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          actualOutputQty: outputQty,
          wastageQty,
          completedAt: new Date(),
        },
      });

      // 5. Update Production Order produced quantity
      const order = await tx.productionOrder.findFirst({ where: { id: batch.orderId, companyId } });
      if (order) {
        const newProduced = round4(Number(order.producedQuantity) + outputQty);
        const isOrderComplete = newProduced >= Number(order.targetQuantity);
        await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            producedQuantity: newProduced,
            status: isOrderComplete ? 'COMPLETED' : 'PARTIALLY_COMPLETED',
            actualEnd: isOrderComplete ? new Date() : null,
          },
        });
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'MANUFACTURING_FG_RECEIPT',
        serviceCode: 'manufacturing_production',
        moduleCode: 'production',
        details: `Received ${outputQty} ${batch.uom} of finished goods (${batch.outputProduct.sku}) into Available inventory under lot ${batch.batchNo}.`,
      });

      return {
        success: true,
        batchId: batch.id,
        batchNo: batch.batchNo,
        receivedQty: outputQty,
        destinationBucket: 'AVAILABLE',
        movementNo: movement.movementNo,
        fgBatchId: fgBatch.id,
      };
    });
  },

  // ====================================================================
  // 9. INTERNAL REPROCESSING & REWORK
  // ====================================================================

  async createReprocessing(companyId, data, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    if (!data.originalBatchId) throw prodError('Original batch ID is required.');
    if (!data.reason) throw prodError('Reprocessing reason is required.');
    if (!data.reworkPlan) throw prodError('Rework plan is required.');
    const quantity = Number(data.quantity);
    if (!quantity || quantity <= 0) throw prodError('Rework quantity must be greater than zero.');

    return prisma.$transaction(async (tx) => {
      const origBatch = await tx.manufacturingBatch.findFirst({
        where: { id: data.originalBatchId, companyId },
        include: { outputProduct: true },
      });
      if (!origBatch) throw prodError('Original manufacturing batch not found.', 404);

      const reprocessNo = String(data.reprocessNo || generateCode('RPR')).trim().toUpperCase();
      const existing = await tx.manufacturingReprocessing.findUnique({
        where: { companyId_reprocessNo: { companyId, reprocessNo } },
      });
      if (existing) throw prodError(`Reprocessing ticket ${reprocessNo} already exists.`, 409);

      const reprocessing = await tx.manufacturingReprocessing.create({
        data: {
          companyId,
          reprocessNo,
          originalBatchId: origBatch.id,
          reason: data.reason,
          reworkPlan: data.reworkPlan,
          additionalInputs: data.additionalInputs || null,
          quantity,
          status: 'PENDING_APPROVAL',
        },
        include: { originalBatch: true },
      });

      // Update original batch status to REPROCESSING
      await tx.manufacturingBatch.update({
        where: { id: origBatch.id },
        data: { status: 'REPROCESSING' },
      });

      // Trigger Phase 1 Approval Request
      await approvalService.createRequest({
        companyId,
        entityType: 'REPROCESSING',
        entityId: reprocessing.id,
        title: `Reprocessing Approval: ${reprocessing.reprocessNo} for Batch ${origBatch.batchNo}`,
        summary: `Rework order for ${quantity} ${origBatch.uom} of ${origBatch.outputProduct.sku}. Reason: ${data.reason}`,
        creatorId: actor.id || actor.userId,
        creatorName: actor.name || 'Plant Supervisor',
        role: actor.role || 'COMPANY_USER',
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'REPROCESSING_CREATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'reprocessing',
        details: `Created reprocessing request ${reprocessing.reprocessNo} for batch ${origBatch.batchNo}.`,
      });

      return reprocessing;
    });
  },

  async completeReprocessingQc(companyId, reprocessId, qcData, actor = {}) {
    if (!companyId) throw prodError('Company ID is required.', 401);

    return prisma.$transaction(async (tx) => {
      const rework = await tx.manufacturingReprocessing.findFirst({
        where: { id: reprocessId, companyId },
        include: { originalBatch: { include: { outputProduct: true } } },
      });
      if (!rework) throw prodError('Reprocessing order not found.', 404);

      // Create QC record for reworked lot
      const qcNo = String(qcData.qcNo || generateCode('QC-RPR')).trim().toUpperCase();
      const status = String(qcData.status || 'PASSED').toUpperCase();

      const qc = await tx.manufacturingQC.create({
        data: {
          companyId,
          qcNo,
          qcType: 'FINISHED_GOODS',
          orderId: rework.originalBatch.orderId,
          batchId: rework.originalBatch.id,
          productId: rework.originalBatch.outputProductId,
          testedQty: rework.quantity,
          passedQty: status === 'PASSED' ? rework.quantity : 0.0,
          rejectedQty: status === 'FAILED' ? rework.quantity : 0.0,
          parameterResults: qcData.parameterResults || null,
          status,
          disposition: status === 'PASSED' ? 'RELEASE_TO_AVAILABLE' : 'REJECT_FOR_REWORK',
          inspectorName: qcData.inspectorName || actor.name || 'Quality Officer',
          testedAt: new Date(),
          remarks: qcData.remarks || 'Post-reprocessing QC inspection',
        },
      });

      // Link post-rework QC and update reprocessing status
      const updated = await tx.manufacturingReprocessing.update({
        where: { id: reprocessId },
        data: {
          postReworkQcId: qc.id,
          status: status === 'PASSED' ? 'COMPLETED' : 'REJECTED',
          completedAt: new Date(),
        },
      });

      return { success: true, reprocessingId: reprocessId, qcNo: qc.qcNo, status: updated.status };
    });
  },

  async listReprocessings(companyId) {
    if (!companyId) throw prodError('Company ID is required.', 401);
    return prisma.manufacturingReprocessing.findMany({
      where: { companyId },
      include: {
        originalBatch: { include: { outputProduct: true } },
        postReworkQc: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export default productionService;

