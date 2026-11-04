import shiftService from '../../services/hrms/shift.service.js';

export const shiftController = {
  async createShiftPolicy(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await shiftService.createShiftPolicy(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listShiftPolicies(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await shiftService.listShiftPolicies(companyId, req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getShiftPolicyById(req, res, next) {
    try {
      const { companyId, shiftId } = req.params;
      const result = await shiftService.getShiftPolicyById(companyId, shiftId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateShiftPolicy(req, res, next) {
    try {
      const { companyId, shiftId } = req.params;
      const result = await shiftService.updateShiftPolicy(companyId, shiftId, req.body, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async assignShiftRoster(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await shiftService.assignShiftRoster(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getEmployeeRoster(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const { startDate, endDate } = req.query;
      const result = await shiftService.getEmployeeRoster(companyId, profileId, startDate, endDate);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default shiftController;

