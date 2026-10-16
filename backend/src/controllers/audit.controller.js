import auditService from '../services/audit.service.js';

export const auditController = {
  /**
   * Retrieve platform audit logs
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
};

export default auditController;
