import attendanceService from '../../services/hrms/attendance.service.js';

export const attendanceController = {
  async recordCheckIn(req, res, next) {
    try {
      const { companyId } = req.params;
      const { employeeProfileId, timestamp, source } = req.body;
      const result = await attendanceService.recordCheckIn(companyId, employeeProfileId, timestamp, source, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async recordCheckOut(req, res, next) {
    try {
      const { companyId } = req.params;
      const { employeeProfileId, timestamp, source } = req.body;
      const result = await attendanceService.recordCheckOut(companyId, employeeProfileId, timestamp, source, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listAttendance(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await attendanceService.listAttendance(companyId, req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async requestRegularization(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await attendanceService.requestRegularization(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async approveRegularization(req, res, next) {
    try {
      const { companyId, regularizationId } = req.params;
      const { decision, rejectionReason } = req.body;
      const result = await attendanceService.approveRegularization(companyId, regularizationId, decision, rejectionReason, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getMonthlyAggregation(req, res, next) {
    try {
      const { companyId } = req.params;
      const month = Number(req.query.month) || new Date().getMonth() + 1;
      const year = Number(req.query.year) || new Date().getFullYear();
      const result = await attendanceService.getMonthlyAggregation(companyId, month, year);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default attendanceController;

