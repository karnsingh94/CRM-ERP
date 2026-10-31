import versionService from '../services/version.service.js';

export const versionController = {
  async getHistory(req, res, next) {
    try {
      const { companyId, entityType, entityId } = req.params;
      const history = await versionService.getVersionHistory(companyId, entityType, entityId);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  },

  async getVersion(req, res, next) {
    try {
      const { companyId, entityType, entityId, versionNumber } = req.params;
      const version = await versionService.getVersion(companyId, entityType, entityId, versionNumber);
      res.json({ success: true, data: version });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },

  async branchVersion(req, res, next) {
    try {
      const { companyId, entityType, entityId } = req.params;
      const { payload, revisionReason } = req.body;
      const newVersion = await versionService.branchNewVersion(
        companyId,
        entityType,
        entityId,
        payload,
        revisionReason,
        req.user
      );
      res.status(201).json({ success: true, data: newVersion });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },

  async lockVersion(req, res, next) {
    try {
      const { companyId, entityType, entityId, versionNumber } = req.params;
      const locked = await versionService.lockVersion(
        companyId,
        entityType,
        entityId,
        Number(versionNumber),
        req.user
      );
      res.json({ success: true, data: locked });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },
};

export default versionController;

