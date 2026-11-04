import employeeService from '../../services/hrms/employee.service.js';

export const employeeController = {
  // Designations
  async createDesignation(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await employeeService.createDesignation(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listDesignations(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await employeeService.listDesignations(companyId, req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getDesignationById(req, res, next) {
    try {
      const { companyId, designationId } = req.params;
      const result = await employeeService.getDesignationById(companyId, designationId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateDesignation(req, res, next) {
    try {
      const { companyId, designationId } = req.params;
      const result = await employeeService.updateDesignation(companyId, designationId, req.body, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteDesignation(req, res, next) {
    try {
      const { companyId, designationId } = req.params;
      const result = await employeeService.deleteDesignation(companyId, designationId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Profiles
  async createProfile(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await employeeService.createProfile(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listProfiles(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await employeeService.listProfiles(companyId, req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getProfileById(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await employeeService.getProfileById(companyId, profileId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await employeeService.updateProfile(companyId, profileId, req.body, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async linkCompanyEmployee(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const { employeeId } = req.body;
      const result = await employeeService.linkCompanyEmployee(companyId, profileId, employeeId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async unlinkCompanyEmployee(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await employeeService.unlinkCompanyEmployee(companyId, profileId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default employeeController;

