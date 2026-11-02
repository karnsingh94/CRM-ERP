import { randomUUID } from 'node:crypto';
import prisma from '../../config/prisma.js';
import { approvalService } from '../approval.service.js';
import { auditService } from '../audit.service.js';

function bomError(message, statusCode = 400, code = 'BOM_ERROR') {
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

function generateCode(prefix = 'BOM') {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${dateStr}-${rand}`;
}

export const bomService = {
  /**
   * Validate formula percentages sum to exactly 100.0000%
   */
  validateFormulaPercentages(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      throw bomError('BOM formula must contain at least one raw material or packaging component.');
    }
    let totalPct = 0;
    for (const item of items) {
      const pct = Number(item.percentage);
      if (isNaN(pct) || pct <= 0) {
        throw bomError(`Component percentage for product ID ${item.productId} must be greater than zero.`);
      }
      totalPct += pct;
    }
    const roundedTotal = round4(totalPct);
    if (Math.abs(roundedTotal - 100.0000) > 0.0001) {
      throw bomError(
        `Formula percentage sum must equal exactly 100.0000%. Current sum: ${roundedTotal.toFixed(4)}%. Difference: ${(100.0000 - roundedTotal).toFixed(4)}%`
      );
    }
    return roundedTotal;
  },

  /**
   * Create a new Bill of Materials (BOM) Formula
   */
  async createBom(companyId, data, actor = {}) {
    if (!companyId) throw bomError('Company ID is required.', 401);
    if (!data.outputProductId) throw bomError('Output finished product ID is required.');

    return prisma.$transaction(async (tx) => {
      // 1. Verify output product belongs to tenant
      const product = await tx.product.findFirst({
        where: { id: data.outputProductId, companyId }
      });
      if (!product) throw bomError('Output product not found or does not belong to active company.', 404);

      // 2. Validate formula percentage
      const items = data.items || [];
      const totalPct = this.validateFormulaPercentages(items);

      const batchSize = Number(data.batchSize) > 0 ? Number(data.batchSize) : 1.0;
      const uom = String(data.uom || product.uom || 'KG').trim().toUpperCase();
      const bomCode = String(data.bomCode || generateCode('BOM')).trim().toUpperCase();
      const version = String(data.version || '1.0').trim();

      // Check unique bomCode + version for company
      const existing = await tx.bomMaster.findUnique({
        where: { companyId_bomCode_version: { companyId, bomCode, version } }
      });
      if (existing) {
        throw bomError(`BOM with code ${bomCode} and version ${version} already exists.`, 409);
      }

      // 3. Verify all component products and compute standard & live costs
      let calculatedStandardCost = 0;
      let calculatedLiveCost = 0;
      const preparedItems = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const compProduct = await tx.product.findFirst({
          where: { id: item.productId, companyId }
        });
        if (!compProduct) {
          throw bomError(`Component product ID ${item.productId} not found in active company.`, 404);
        }

        const pct = round4(item.percentage);
        const qtyPerBatch = round4((pct / 100) * batchSize);
        const stdCost = Number(item.standardUnitCost) >= 0 ? Number(item.standardUnitCost) : Number(compProduct.purchasePrice || 0);
        const liveCost = Number(compProduct.purchasePrice || 0);

        calculatedStandardCost += qtyPerBatch * stdCost;
        calculatedLiveCost += qtyPerBatch * liveCost;

        preparedItems.push({
          companyId,
          productId: compProduct.id,
          itemType: item.itemType || 'RAW_MATERIAL',
          percentage: pct,
          quantityPerBatch: qtyPerBatch,
          uom: String(item.uom || compProduct.uom || uom).trim().toUpperCase(),
          scrapTolerancePct: Number(item.scrapTolerancePct !== undefined ? item.scrapTolerancePct : item.scrapPercentage) || 0.00,
          standardUnitCost: stdCost,
          sequenceOrder: item.sequenceOrder || i + 1,
          notes: item.notes || null,
        });
      }

      // 4. Create BOM Master header
      const bom = await tx.bomMaster.create({
        data: {
          companyId,
          bomCode,
          bomName: String(data.bomName || `${product.name} Formula`).trim(),
          outputProductId: product.id,
          outputProductSku: product.sku,
          version,
          revisionNumber: 1,
          batchSize,
          uom,
          description: data.description || null,
          totalPercentage: totalPct,
          standardCost: round2(calculatedStandardCost),
          liveCost: round2(calculatedLiveCost),
          status: 'DRAFT',
          isLocked: false,
          createdById: actor.id || actor.userId || null,
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: { include: { product: true } },
          outputProduct: true,
        },
      });

      // 5. Audit Log
      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'BOM_CREATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'bom',
        details: `Created BOM formula ${bom.bomCode} v${bom.version} for product ${product.sku} with ${preparedItems.length} components.`,
        newValue: { bomId: bom.id, bomCode: bom.bomCode, version: bom.version },
      });

      return bom;
    });
  },

  /**
   * Update an existing draft BOM
   */
  async updateBom(companyId, bomId, data, actor = {}) {
    if (!companyId) throw bomError('Company ID is required.', 401);

    return prisma.$transaction(async (tx) => {
      const bom = await tx.bomMaster.findFirst({
        where: { id: bomId, companyId },
        include: { items: true, outputProduct: true },
      });
      if (!bom) throw bomError('BOM not found.', 404);

      if (bom.isLocked || bom.status === 'APPROVED') {
        throw bomError(
          `Approved BOM version ${bom.bomCode} v${bom.version} is locked and cannot be edited. Please branch a new revision.`,
          409,
          'DOCUMENT_VERSION_LOCKED'
        );
      }

      let totalPct = bom.totalPercentage;
      let calculatedStandardCost = 0;
      let calculatedLiveCost = 0;
      const batchSize = Number(data.batchSize) > 0 ? Number(data.batchSize) : Number(bom.batchSize);

      if (data.items && Array.isArray(data.items)) {
        totalPct = this.validateFormulaPercentages(data.items);
        await tx.bomItem.deleteMany({ where: { bomId } });

        const newItems = [];
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const compProduct = await tx.product.findFirst({
            where: { id: item.productId, companyId },
          });
          if (!compProduct) throw bomError(`Component product ID ${item.productId} not found.`, 404);

          const pct = round4(item.percentage);
          const qtyPerBatch = round4((pct / 100) * batchSize);
          const stdCost = Number(item.standardUnitCost) >= 0 ? Number(item.standardUnitCost) : Number(compProduct.purchasePrice || 0);
          const liveCost = Number(compProduct.purchasePrice || 0);

          calculatedStandardCost += qtyPerBatch * stdCost;
          calculatedLiveCost += qtyPerBatch * liveCost;

          newItems.push({
            companyId,
            bomId,
            productId: compProduct.id,
            itemType: item.itemType || 'RAW_MATERIAL',
            percentage: pct,
            quantityPerBatch: qtyPerBatch,
            uom: String(item.uom || compProduct.uom || bom.uom).trim().toUpperCase(),
            scrapTolerancePct: Number(item.scrapTolerancePct !== undefined ? item.scrapTolerancePct : item.scrapPercentage) || 0.00,
            standardUnitCost: stdCost,
            sequenceOrder: item.sequenceOrder || i + 1,
            notes: item.notes || null,
          });
        }
        await tx.bomItem.createMany({ data: newItems });
      }

      const updated = await tx.bomMaster.update({
        where: { id: bomId },
        data: {
          bomName: data.bomName ? String(data.bomName).trim() : bom.bomName,
          description: data.description !== undefined ? data.description : bom.description,
          batchSize,
          totalPercentage: totalPct,
          standardCost: calculatedStandardCost > 0 ? round2(calculatedStandardCost) : bom.standardCost,
          liveCost: calculatedLiveCost > 0 ? round2(calculatedLiveCost) : bom.liveCost,
        },
        include: {
          items: { include: { product: true } },
          outputProduct: true,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'BOM_UPDATE',
        serviceCode: 'manufacturing_production',
        moduleCode: 'bom',
        details: `Updated draft BOM ${bom.bomCode} v${bom.version}.`,
      });

      return updated;
    });
  },

  /**
   * Branch a new BOM revision from an approved or existing BOM
   */
  async branchRevision(companyId, bomId, data = {}, actor = {}) {
    if (!companyId) throw bomError('Company ID is required.', 401);

    return prisma.$transaction(async (tx) => {
      const parentBom = await tx.bomMaster.findFirst({
        where: { id: bomId, companyId },
        include: { items: true, outputProduct: true },
      });
      if (!parentBom) throw bomError('Parent BOM not found.', 404);

      // Determine next version string
      let nextVersion = data.version;
      if (!nextVersion) {
        const parts = parentBom.version.split('.');
        const major = Number(parts[0]) || 1;
        const minor = (Number(parts[1]) || 0) + 1;
        nextVersion = `${major}.${minor}`;
      }

      // Check unique constraint
      const existing = await tx.bomMaster.findUnique({
        where: { companyId_bomCode_version: { companyId, bomCode: parentBom.bomCode, version: nextVersion } }
      });
      if (existing) {
        throw bomError(`BOM version ${parentBom.bomCode} v${nextVersion} already exists.`, 409);
      }

      const newBom = await tx.bomMaster.create({
        data: {
          companyId,
          bomCode: parentBom.bomCode,
          bomName: data.bomName || parentBom.bomName,
          outputProductId: parentBom.outputProductId,
          outputProductSku: parentBom.outputProductSku,
          version: nextVersion,
          revisionNumber: parentBom.revisionNumber + 1,
          parentBomId: parentBom.id,
          revisionReason: data.revisionReason || 'Revision branched for formula adjustment',
          batchSize: parentBom.batchSize,
          uom: parentBom.uom,
          description: data.description || parentBom.description,
          totalPercentage: parentBom.totalPercentage,
          standardCost: parentBom.standardCost,
          liveCost: parentBom.liveCost,
          status: 'DRAFT',
          isLocked: false,
          createdById: actor.id || actor.userId || null,
          items: {
            create: parentBom.items.map((item) => ({
              companyId,
              productId: item.productId,
              itemType: item.itemType,
              percentage: item.percentage,
              quantityPerBatch: item.quantityPerBatch,
              uom: item.uom,
              scrapTolerancePct: item.scrapTolerancePct,
              standardUnitCost: item.standardUnitCost,
              sequenceOrder: item.sequenceOrder,
              notes: item.notes,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          outputProduct: true,
          parentBom: true,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'System',
        action: 'BOM_BRANCH_REVISION',
        serviceCode: 'manufacturing_production',
        moduleCode: 'bom',
        details: `Branched new revision ${newBom.bomCode} v${newBom.version} from parent v${parentBom.version}.`,
        newValue: { newBomId: newBom.id, parentBomId: parentBom.id },
      });

      return newBom;
    });
  },

  /**
   * Submit BOM for approval using Phase 1 Approval Engine
   */
  async submitForApproval(companyId, bomId, actor = {}) {
    if (!companyId) throw bomError('Company ID is required.', 401);

    const bom = await prisma.bomMaster.findFirst({
      where: { id: bomId, companyId },
      include: { items: true, outputProduct: true },
    });
    if (!bom) throw bomError('BOM not found.', 404);
    if (bom.status === 'APPROVED') throw bomError('BOM is already approved.', 400);

    // Re-verify formula percentage = 100.0000%
    this.validateFormulaPercentages(bom.items);

    // Update status to PENDING_APPROVAL
    await prisma.bomMaster.update({
      where: { id: bomId },
      data: { status: 'PENDING_APPROVAL' },
    });

    // Create approval request
    const approvalReq = await approvalService.createRequest({
      companyId,
      entityType: 'BOM_MASTER',
      entityId: bomId,
      title: `BOM Approval: ${bom.bomCode} v${bom.version} (${bom.outputProductSku})`,
      summary: `Formula for ${bom.outputProduct.name}. Standard Batch Size: ${bom.batchSize} ${bom.uom}. Components: ${bom.items.length}. Standard Cost: ₹${bom.standardCost}`,
      amount: Number(bom.standardCost) || 0,
      creatorId: actor.id || actor.userId,
      creatorName: actor.name || 'BOM Engineer',
      role: actor.role || 'COMPANY_USER',
    });

    return { success: true, bomId, status: 'PENDING_APPROVAL', approvalReq };
  },

  /**
   * Approve BOM - Locks the version permanently
   */
  async approveBom(companyId, bomId, actor = {}) {
    if (!companyId) throw bomError('Company ID is required.', 401);

    const bom = await prisma.bomMaster.findFirst({
      where: { id: bomId, companyId },
      include: { items: true },
    });
    if (!bom) throw bomError('BOM not found.', 404);

    this.validateFormulaPercentages(bom.items);

    const approved = await prisma.bomMaster.update({
      where: { id: bomId },
      data: {
        status: 'APPROVED',
        isLocked: true,
        approvedById: actor.id || actor.userId || null,
        approvedAt: new Date(),
      },
      include: { items: { include: { product: true } }, outputProduct: true },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'System',
      action: 'BOM_APPROVE',
      serviceCode: 'manufacturing_production',
      moduleCode: 'bom',
      details: `Approved and locked BOM formula ${approved.bomCode} v${approved.version}.`,
    });

    return approved;
  },

  /**
   * Costing & Batch simulation for BOM
   */
  async simulateCosting(companyId, bomId, targetBatchSize = null) {
    if (!companyId) throw bomError('Company ID is required.', 401);

    const bom = await prisma.bomMaster.findFirst({
      where: { id: bomId, companyId },
      include: {
        items: { include: { product: true } },
        outputProduct: true,
      },
    });
    if (!bom) throw bomError('BOM not found.', 404);

    const baseBatchSize = Number(bom.batchSize) || 1.0;
    const targetSize = Number(targetBatchSize) > 0 ? Number(targetBatchSize) : baseBatchSize;
    const scaleFactor = targetSize / baseBatchSize;

    let totalStandardCost = 0;
    let totalLiveCost = 0;

    const componentSimulations = bom.items.map((item) => {
      const scaledQty = round4(Number(item.quantityPerBatch) * scaleFactor);
      const stdUnitCost = Number(item.standardUnitCost);
      const liveUnitCost = Number(item.product.purchasePrice || item.standardUnitCost || 0);

      const itemStdCost = round2(scaledQty * stdUnitCost);
      const itemLiveCost = round2(scaledQty * liveUnitCost);

      totalStandardCost += itemStdCost;
      totalLiveCost += itemLiveCost;

      return {
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        itemType: item.itemType,
        percentage: Number(item.percentage),
        scaledQuantity: scaledQty,
        uom: item.uom,
        standardUnitCost: stdUnitCost,
        liveUnitCost,
        totalStandardCost: itemStdCost,
        totalLiveCost: itemLiveCost,
        scrapTolerancePct: Number(item.scrapTolerancePct),
        estimatedScrapQty: round4(scaledQty * (Number(item.scrapTolerancePct) / 100)),
      };
    });

    return {
      bomId: bom.id,
      bomCode: bom.bomCode,
      version: bom.version,
      outputProduct: {
        id: bom.outputProduct.id,
        sku: bom.outputProduct.sku,
        name: bom.outputProduct.name,
        uom: bom.outputProduct.uom,
      },
      standardBatchSize: baseBatchSize,
      targetBatchSize: targetSize,
      scaleFactor: round4(scaleFactor),
      totalStandardCost: round2(totalStandardCost),
      totalLiveCost: round2(totalLiveCost),
      unitCostStandard: round2(totalStandardCost / targetSize),
      unitCostLive: round2(totalLiveCost / targetSize),
      variance: round2(totalLiveCost - totalStandardCost),
      variancePct: totalStandardCost > 0 ? round2(((totalLiveCost - totalStandardCost) / totalStandardCost) * 100) : 0,
      components: componentSimulations,
    };
  },

  /**
   * List BOMs with filtering and pagination
   */
  async listBoms(companyId, query = {}) {
    if (!companyId) throw bomError('Company ID is required.', 401);

    const where = { companyId };
    if (query.outputProductId) where.outputProductId = query.outputProductId;
    if (query.status) where.status = query.status;
    if (query.isLocked !== undefined) where.isLocked = query.isLocked === 'true' || query.isLocked === true;
    if (query.search) {
      where.OR = [
        { bomCode: { contains: query.search } },
        { bomName: { contains: query.search } },
        { outputProductSku: { contains: query.search } },
      ];
    }

    return prisma.bomMaster.findMany({
      where,
      include: {
        outputProduct: { select: { id: true, sku: true, name: true, uom: true, category: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, uom: true } } } },
        parentBom: { select: { id: true, bomCode: true, version: true } },
        _count: { select: { items: true, productionOrders: true, productionPlans: true } },
      },
      orderBy: [{ bomCode: 'asc' }, { revisionNumber: 'desc' }],
    });
  },

  /**
   * Get single BOM by ID
   */
  async getBomById(companyId, bomId) {
    if (!companyId) throw bomError('Company ID is required.', 401);

    const bom = await prisma.bomMaster.findFirst({
      where: { id: bomId, companyId },
      include: {
        outputProduct: true,
        items: {
          include: { product: true },
          orderBy: { sequenceOrder: 'asc' },
        },
        parentBom: true,
        childRevisions: true,
        productionPlans: { take: 5, orderBy: { createdAt: 'desc' } },
        productionOrders: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!bom) throw bomError('BOM not found.', 404);
    return bom;
  },
};

export default bomService;

