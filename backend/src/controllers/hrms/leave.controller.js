import leaveService from '../../services/hrms/leave.service.js';

export const leaveController = {
  async createLeaveType(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await leaveService.createLeaveType(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listLeaveTypes(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await leaveService.listLeaveTypes(companyId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async createLeavePolicy(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await leaveService.createLeavePolicy(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listLeavePolicies(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await leaveService.listLeavePolicies(companyId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getLeaveBalances(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const year = req.query.year || new Date().getFullYear();
      const result = await leaveService.getLeaveBalances(companyId, profileId, year);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async applyLeave(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await leaveService.applyLeave(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async approveLeave(req, res, next) {
    try {
      const { companyId, leaveRequestId } = req.params;
      const result = await leaveService.approveLeave(companyId, leaveRequestId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async rejectLeave(req, res, next) {
    try {
      const { companyId, leaveRequestId } = req.params;
      const { reason } = req.body;
      const result = await leaveService.rejectLeave(companyId, leaveRequestId, reason, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async cancelLeave(req, res, next) {
    try {
      const { companyId, leaveRequestId } = req.params;
      const result = await leaveService.cancelLeave(companyId, leaveRequestId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listLeaveRequests(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await leaveService.listLeaveRequests(companyId, req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default leaveController;

