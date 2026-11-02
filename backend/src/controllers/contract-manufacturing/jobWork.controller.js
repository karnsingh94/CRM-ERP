import jobWorkService from '../../services/contract-manufacturing/jobWork.service.js';

function handle(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code || 'JOB_WORK_ERROR',
    });
  }
  return next(error);
}

export const jobWorkController = {
  // ====================================================================
  // 1. DASHBOARD
  // ====================================================================

  async getDashboard(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await jobWorkService.getDashboardMetrics(companyId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 2. CONTRACT MANUFACTURERS
  // ====================================================================

  async listManufacturers(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await jobWorkService.listContractManufacturers(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getManufacturerHistory(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const vendorId = String(req.params.vendorId);
      const data = await jobWorkService.getManufacturerHistory(companyId, vendorId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 3. JOB WORK ORDERS CRUD & APPROVAL
  // ====================================================================

  async createOrder(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await jobWorkService.createJobWorkOrder(companyId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listOrders(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await jobWorkService.listJobWorkOrders(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getOrderById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.getJobWorkOrderById(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async updateOrder(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.updateJobWorkOrder(companyId, orderId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async submitOrderApproval(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.submitOrderForApproval(companyId, orderId, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async approveOrder(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.approveJobWorkOrder(companyId, orderId, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 4. MATERIAL REQUIREMENTS & FIFO DISPATCH
  // ====================================================================

  async getMaterialRequirements(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.calculateMaterialRequirements(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async dispatchMaterials(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.dispatchMaterials(companyId, orderId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 5. CHALLANS & ACKNOWLEDGEMENT
  // ====================================================================

  async listChallans(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await jobWorkService.listChallans(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getChallanById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const challanId = String(req.params.challanId);
      const data = await jobWorkService.getChallanById(companyId, challanId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async acknowledgeChallan(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const challanId = String(req.params.challanId);
      const data = await jobWorkService.acknowledgeChallan(companyId, challanId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 6. EXTERNAL MATERIAL RETURNS
  // ====================================================================

  async returnMaterials(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.returnMaterials(companyId, orderId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listMaterialReturns(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.listMaterialReturns(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 7. EXTERNAL PRODUCTION MILESTONES
  // ====================================================================

  async addMilestone(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.addMilestone(companyId, orderId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listMilestones(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.listMilestones(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 8. FINISHED GOODS RECEIPTS & QC
  // ====================================================================

  async createReceipt(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.createReceipt(companyId, orderId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listReceipts(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await jobWorkService.listReceipts(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getReceiptById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const receiptId = String(req.params.receiptId);
      const data = await jobWorkService.getReceiptById(companyId, receiptId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async inspectReceiptQc(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const receiptId = String(req.params.receiptId);
      const data = await jobWorkService.inspectReceiptQc(companyId, receiptId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 9. EXTERNAL REWORK
  // ====================================================================

  async createReworkRequest(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const receiptId = String(req.params.receiptId);
      const data = await jobWorkService.createReworkRequest(companyId, receiptId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async receiveReworkedGoods(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const receiptId = String(req.params.receiptId);
      const data = await jobWorkService.receiveReworkedGoods(companyId, receiptId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  // ====================================================================
  // 10. MATERIAL RECONCILIATION & SETTLEMENT
  // ====================================================================

  async getReconciliationPreview(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.calculateReconciliationPreview(companyId, orderId, { ...req.query, ...req.body });
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async finalizeReconciliation(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await jobWorkService.finalizeReconciliation(companyId, orderId, req.body || {}, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async listReconciliations(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await jobWorkService.listReconciliations(companyId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async getReconciliationById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const reconciliationId = String(req.params.reconciliationId);
      const data = await jobWorkService.getReconciliationById(companyId, reconciliationId);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async settleJobWork(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const reconciliationId = String(req.params.reconciliationId);
      const data = await jobWorkService.settleJobWork(companyId, reconciliationId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },

  async togglePaymentHold(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const reconciliationId = String(req.params.reconciliationId);
      const data = await jobWorkService.togglePaymentHold(companyId, reconciliationId, req.body || {}, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handle(error, res, next);
    }
  },
};

export default jobWorkController;

