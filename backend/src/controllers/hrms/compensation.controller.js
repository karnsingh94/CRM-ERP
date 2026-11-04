import salaryStructureService from '../../services/hrms/salaryStructure.service.js';
import statutoryService from '../../services/hrms/statutory.service.js';

export const compensationController = {
  // Components
  async createComponent(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await salaryStructureService.createComponent(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listComponents(req, res, next) {
    try {
      const { companyId } = req.params;
      const { type } = req.query;
      const result = await salaryStructureService.listComponents(companyId, type);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Structures
  async createStructure(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await salaryStructureService.createStructure(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listStructures(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await salaryStructureService.listStructures(companyId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getStructureById(req, res, next) {
    try {
      const { companyId, structureId } = req.params;
      const result = await salaryStructureService.getStructureById(companyId, structureId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Salary Assignments
  async assignSalary(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await salaryStructureService.assignSalary(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getSalaryHistory(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await salaryStructureService.getSalaryHistory(companyId, profileId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Statutory Rules
  async setStatutoryRule(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await statutoryService.setRule(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listStatutoryRules(req, res, next) {
    try {
      const { companyId } = req.params;
      const { ruleType } = req.query;
      const result = await statutoryService.listRules(companyId, ruleType);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async calculateStatutoryPreview(req, res, next) {
    try {
      const { companyId } = req.params;
      const { basicWage, grossWage, state } = req.body;
      const asOf = new Date();

      const [epf, esic, pt, tds] = await Promise.all([
        statutoryService.calculateEpf(companyId, basicWage, asOf),
        statutoryService.calculateEsic(companyId, grossWage, asOf),
        statutoryService.calculateProfessionalTax(companyId, grossWage, state, asOf.getMonth() + 1, asOf),
        statutoryService.calculateTds(companyId, grossWage, asOf),
      ]);

      res.json({
        success: true,
        data: { epf, esic, pt, tds },
      });
    } catch (err) {
      next(err);
    }
  },
};

export default compensationController;

