import returnsService from '../../services/dispatch/returns.service.js';

function handleError(error, res, next) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const returnsController = {
  async getDashboard(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await returnsService.getDashboard(companyId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async listEligibleDispatches(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await returnsService.listEligibleDispatches(companyId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async createReturnRequest(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await returnsService.createReturnRequest(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async listReturns(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await returnsService.listReturns(companyId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getReturnById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const returnId = String(req.params.returnId);
      const data = await returnsService.getReturnById(companyId, returnId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async submitForApproval(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const returnId = String(req.params.returnId);
      const data = await returnsService.submitForApproval(companyId, returnId, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async approveReturn(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const returnId = String(req.params.returnId);
      const data = await returnsService.approveReturn(companyId, returnId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async rejectReturn(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const returnId = String(req.params.returnId);
      const data = await returnsService.rejectReturn(companyId, returnId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async receiveReturnedGoods(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const returnId = String(req.params.returnId);
      const data = await returnsService.receiveReturnedGoods(companyId, returnId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async inspectReturnedGoods(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const returnId = String(req.params.returnId);
      const data = await returnsService.inspectReturnedGoods(companyId, returnId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },
};

export default returnsController;

