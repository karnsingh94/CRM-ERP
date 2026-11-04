import kycService from '../../services/hrms/kyc.service.js';

export const kycController = {
  async getKycRecord(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await kycService.getKycRecord(companyId, profileId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async verifyKycField(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const { field, status, remarks } = req.body;
      const result = await kycService.verifyKycField(companyId, profileId, field, status, remarks, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async submitKycApproval(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await kycService.submitKycApproval(companyId, profileId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async processApprovalDecision(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const { decision, remarks } = req.body;
      const result = await kycService.processApprovalDecision(companyId, profileId, decision, remarks, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default kycController;

