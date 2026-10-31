import approvalService from '../services/approval.service.js';

export const approvalController = {
  async submitRequest(req, res, next) {
    try {
      const companyId = req.params.companyId;
      const request = await approvalService.createRequest(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: request });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },

  async recordDecision(req, res, next) {
    try {
      const { companyId, requestId } = req.params;
      const result = await approvalService.recordDecision(companyId, requestId, req.body, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },

  async listRequests(req, res, next) {
    try {
      const companyId = req.params.companyId;
      const result = await approvalService.listRequests(companyId, req.query, req.user);
      res.json({ success: true, data: result.items, total: result.total });
    } catch (err) {
      next(err);
    }
  },

  async getRequest(req, res, next) {
    try {
      const { companyId, requestId } = req.params;
      const request = await approvalService.getRequestById(companyId, requestId);
      res.json({ success: true, data: request });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },
};

export default approvalController;

