import departmentService from '../services/department.service.js';

export const departmentController = {
  // ==================== EMPLOYEES ====================
  async getCompanyEmployees(req, res, next) {
    try {
      const employees = await departmentService.getCompanyEmployees(req.params.companyId, req.user);
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
        req.meta || {},
        req.user
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
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: employee });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async updateEmployeePermissions(req, res, next) {
    try {
      const employee = await departmentService.updateEmployeePermissions(
        req.params.companyId,
        req.params.employeeId,
        req.body,
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: employee });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async toggleCompanyEmployeeStatus(req, res, next) {
    try {
      const employee = await departmentService.toggleCompanyEmployeeStatus(
        req.params.companyId,
        req.params.employeeId,
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: employee });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async removeServiceTeamEmployee(req, res, next) {
    try {
      const team = await departmentService.removeServiceTeamEmployee(
        req.params.companyId,
        req.params.serviceCode,
        req.params.teamId,
        req.params.employeeId,
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: team });
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
        req.params.serviceCode,
        req.user
      );
      res.json({ success: true, data: team });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async getServiceTeams(req, res, next) {
    try {
      const teams = await departmentService.listServiceTeams(
        req.params.companyId,
        req.params.serviceCode,
        req.user
      );
      res.json({ success: true, data: teams });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async createServiceTeam(req, res, next) {
    try {
      const team = await departmentService.createServiceTeam(
        req.params.companyId,
        req.params.serviceCode,
        req.body,
        req.meta || {},
        req.user
      );
      res.status(201).json({ success: true, data: team });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async updateServiceTeam(req, res, next) {
    try {
      const team = await departmentService.updateServiceTeam(
        req.params.companyId,
        req.params.serviceCode,
        req.params.teamId,
        req.body,
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: team });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async toggleServiceTeamStatus(req, res, next) {
    try {
      const team = await departmentService.toggleServiceTeamStatus(
        req.params.companyId,
        req.params.serviceCode,
        req.params.teamId,
        req.meta || {},
        req.user
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
        req.meta || {},
        req.body.teamId,
        req.user
      );
      res.json({ success: true, data: team });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async setServiceTeamPermissions(req, res, next) {
    try {
      const team = await departmentService.setServiceTeamPermissions(
        req.params.companyId,
        req.params.serviceCode,
        req.body.permissions,
        req.meta || {},
        req.body.teamId,
        req.user
      );
      res.json({ success: true, data: team });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async createDepartmentHead(req, res, next) {
    try {
      const head = await departmentService.createDepartmentHead(
        req.params.companyId,
        req.params.serviceCode,
        req.body,
        req.meta || {},
        req.user
      );
      res.status(201).json({ success: true, data: head });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async updateDepartmentHead(req, res, next) {
    try {
      const head = await departmentService.updateDepartmentHead(
        req.params.companyId,
        req.params.serviceCode,
        req.params.employeeId,
        req.body,
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: head });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async toggleDepartmentHeadStatus(req, res, next) {
    try {
      const head = await departmentService.toggleDepartmentHeadStatus(
        req.params.companyId,
        req.params.serviceCode,
        req.params.employeeId,
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: head });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async updateDepartmentHeadPermissions(req, res, next) {
    try {
      const head = await departmentService.updateDepartmentHeadPermissions(
        req.params.companyId,
        req.params.serviceCode,
        req.params.employeeId,
        req.body.permissions,
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: head });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },

  async removeDepartmentHead(req, res, next) {
    try {
      const result = await departmentService.removeDepartmentHead(
        req.params.companyId,
        req.params.serviceCode,
        req.params.employeeId,
        req.meta || {},
        req.user
      );
      res.json({ success: true, data: result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
      }
      next(err);
    }
  },
};

export default departmentController;
