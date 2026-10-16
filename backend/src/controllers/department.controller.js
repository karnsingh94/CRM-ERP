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

  // ==================== DEPARTMENTS ====================
  async getAllDepartmentsForCompany(req, res, next) {
    try {
      const departments = await departmentService.getAllDepartmentsForCompany(req.params.companyId);
      res.json({ success: true, data: departments });
    } catch (err) {
      next(err);
    }
  },

  async getDepartmentsByService(req, res, next) {
    try {
      const result = await departmentService.getDepartmentsByService(
        req.params.companyId,
        req.params.serviceCode
      );
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async createDepartment(req, res, next) {
    try {
      const department = await departmentService.createDepartment(
        req.params.companyId,
        req.params.serviceCode,
        req.body,
        req.meta || {}
      );
      res.status(201).json({ success: true, data: department });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async updateDepartment(req, res, next) {
    try {
      const updated = await departmentService.updateDepartment(
        req.params.companyId,
        req.params.departmentId,
        req.body,
        req.meta || {}
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async deleteDepartment(req, res, next) {
    try {
      await departmentService.deleteDepartment(
        req.params.companyId,
        req.params.departmentId,
        req.meta || {}
      );
      res.json({ success: true, message: 'Department removed successfully' });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async assignDepartmentEmployees(req, res, next) {
    try {
      const { employeeIds } = req.body;
      const updated = await departmentService.assignDepartmentEmployees(
        req.params.companyId,
        req.params.departmentId,
        employeeIds || [],
        req.meta || {}
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },
};

export default departmentController;
