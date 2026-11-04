import biometricService from '../../services/hrms/biometric.service.js';

export const biometricController = {
  async registerDevice(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await biometricService.registerDevice(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listDevices(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await biometricService.listDevices(companyId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateDevicePing(req, res, next) {
    try {
      const { companyId, deviceSerial } = req.params;
      const result = await biometricService.updateDevicePing(companyId, deviceSerial);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async ingestPunchLogs(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await biometricService.ingestPunchLogs(companyId, req.body, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async processUnprocessedPunches(req, res, next) {
    try {
      const { companyId } = req.params;
      const limit = req.query.limit || 500;
      const result = await biometricService.processUnprocessedPunches(companyId, limit);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default biometricController;

