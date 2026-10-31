import auditService from '../services/audit.service.js';

export const auditController = {
  /**
   * Retrieve platform audit logs (Super Admin)
   */
  async getAuditLogs(req, res, next) {
    try {
      const limit = req.query.limit || 100;
      const logs = await auditService.getAuditLogs(limit);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Retrieve tenant-isolated company audit logs
   */
  async getCompanyAuditLogs(req, res, next) {
    try {
      const companyId = req.params.companyId;
      const result = await auditService.getCompanyAuditLogs(companyId, req.query);
      res.json({ success: true, data: result.items, total: result.total });
    } catch (err) {
      next(err);
    }
  },
};

export default auditController;
