import departmentService from '../services/department.service.js';

export const departmentController = {
  // ==================== EMPLOYEES ====================
  async getCompanyEmployees(req, res, next) {
    try {
      const employees = await departmentService.getCompanyEmployees(req.params.companyId);
      res.json({ success: true, data: employees });
    } catch (err) {
      next(err);
    }
  },

  async createCompanyEmployee(req, res, next) {
    try {
      const employee = await departmentService.createCompanyEmployee(
        req.params.companyId,
        req.body,
        req.meta || {}
      );
      res.status(201).json({ success: true, data: employee });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async assignCompanyEmployee(req, res, next) {
    try {
      const employee = await departmentService.assignCompanyEmployee(
        req.params.companyId,
        req.params.employeeId,
        req.body,
        req.meta || {}
      );
      res.json({ success: true, data: employee });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async getServiceTeam(req, res, next) {
    try {
      const team = await departmentService.getServiceTeam(
        req.params.companyId,
        req.params.serviceCode
      );
      res.json({ success: true, data: team });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async setServiceTeamHead(req, res, next) {
    try {
      const team = await departmentService.setServiceTeamHead(
        req.params.companyId,
        req.params.serviceCode,
        req.body.headId,
        req.meta || {}
      );
      res.json({ success: true, data: team });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

};

export default departmentController;
