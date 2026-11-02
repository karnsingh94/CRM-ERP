import bomService from '../../services/production/bom.service.js';
import productionService from '../../services/production/production.service.js';

function handle(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'PRODUCTION_ERROR',
    });
  }
  return next(error);
}

export const productionController = {
  // ====================================================================
  // 1. BILL OF MATERIALS (BOM) & FORMULA MANAGEMENT
  // ====================================================================

  async createBom(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await bomService.createBom(companyId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async updateBom(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const bomId = String(req.params.bomId);
      const data = await bomService.updateBom(companyId, bomId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listBoms(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await bomService.listBoms(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getBomById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const bomId = String(req.params.bomId);
      const data = await bomService.getBomById(companyId, bomId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async submitBomApproval(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const bomId = String(req.params.bomId);
      const data = await bomService.submitForApproval(companyId, bomId, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async approveBom(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const bomId = String(req.params.bomId);
      const data = await bomService.approveBom(companyId, bomId, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async branchBomRevision(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const bomId = String(req.params.bomId);
      const data = await bomService.branchRevision(companyId, bomId, req.body?.notes, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async simulateBomCosting(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const bomId = String(req.params.bomId);
      const targetBatchSize = req.query?.targetBatchSize ? Number(req.query.targetBatchSize) : null;
      const data = await bomService.simulateCosting(companyId, bomId, targetBatchSize);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 2. PRODUCTION PLANNING
  // ====================================================================

  async createPlan(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.createPlan(companyId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listPlans(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.listPlans(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getPlanById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const planId = String(req.params.planId);
      const data = await productionService.getPlanById(companyId, planId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 3. PRODUCTION ORDERS & MATERIAL REQUIREMENTS
  // ====================================================================

  async createOrder(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.createOrder(companyId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listOrders(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.listOrders(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getOrderById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await productionService.getOrderById(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async updateOrderStatus(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const status = req.body?.status;
      const data = await productionService.updateOrderStatus(companyId, orderId, status, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async checkMaterialAvailability(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await productionService.checkMaterialAvailability(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 4. MATERIAL ISSUE & RETURN (SHOP FLOOR)
  // ====================================================================

  async issueMaterials(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await productionService.issueMaterialsFIFO(companyId, orderId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async returnUnusedMaterial(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.returnUnusedMaterial(companyId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 5. MANUFACTURING BATCHES & SEQUENTIAL MIXING GATES
  // ====================================================================

  async createBatch(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await productionService.createBatch(companyId, orderId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async completeProcessStep(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const batchId = String(req.params.batchId);
      const stepNumber = Number(req.params.stepNumber);
      const data = await productionService.completeProcessStep(companyId, batchId, stepNumber, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getBatchGenealogy(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const batchId = String(req.params.batchId);
      const data = await productionService.getBatchGenealogy(companyId, batchId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async traceRawMaterialForward(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const rmBatchId = String(req.params.rmBatchId);
      const data = await productionService.traceRawMaterialForward(companyId, rmBatchId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 6. DAILY PRODUCTION REPORTS (DPR)
  // ====================================================================

  async createDpr(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.createDpr(companyId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listDprs(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.listDprs(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 7. MANUFACTURING QUALITY CONTROL & FINISHED GOODS RECEIPT
  // ====================================================================

  async createQcInspection(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.createQcInspection(companyId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listQcInspections(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.listQcInspections(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async receiveFinishedGoods(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const batchId = String(req.params.batchId);
      const data = await productionService.receiveFinishedGoods(companyId, batchId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 8. INTERNAL REPROCESSING
  // ====================================================================

  async createReprocessing(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.createReprocessing(companyId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listReprocessings(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await productionService.listReprocessings(companyId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async completeReprocessingQc(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const reprocessId = String(req.params.reprocessId);
      const data = await productionService.completeReprocessingQc(companyId, reprocessId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },
};

export default productionController;

