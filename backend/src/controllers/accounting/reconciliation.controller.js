import bankReconciliationService from '../../services/accounting/bankReconciliation.service.js';

export const reconciliationController = {
  async createSession(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await bankReconciliationService.createSession(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getSessionById(req, res, next) {
    try {
      const { companyId, reconciliationId } = req.params;
      const result = await bankReconciliationService.getSessionById(companyId, reconciliationId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listSessions(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await bankReconciliationService.listSessions(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async manualMatch(req, res, next) {
    try {
      const { companyId, reconciliationId } = req.params;
      const result = await bankReconciliationService.manualMatch(companyId, reconciliationId, req.body, req.user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async autoMatch(req, res, next) {
    try {
      const { companyId, reconciliationId } = req.params;
      const result = await bankReconciliationService.autoMatch(companyId, reconciliationId, req.body, req.user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async unmatchItem(req, res, next) {
    try {
      const { companyId, reconciliationId, itemId } = req.params;
      const result = await bankReconciliationService.unmatchItem(companyId, reconciliationId, itemId, req.user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async postBankAdjustmentVoucher(req, res, next) {
    try {
      const { companyId, reconciliationId } = req.params;
      const result = await bankReconciliationService.postBankAdjustmentVoucher(companyId, reconciliationId, req.body, req.user);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async closeSession(req, res, next) {
    try {
      const { companyId, reconciliationId } = req.params;
      const result = await bankReconciliationService.closeSession(companyId, reconciliationId, req.body, req.user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default reconciliationController;

