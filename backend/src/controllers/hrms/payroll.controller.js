import payrollService from '../../services/hrms/payroll.service.js';
import payslipService from '../../services/hrms/payslip.service.js';

export const payrollController = {
  async createBatch(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await payrollService.createBatch(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async calculateBatch(req, res, next) {
    try {
      const { companyId, batchId } = req.params;
      const result = await payrollService.calculateBatch(companyId, batchId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async submitForApproval(req, res, next) {
    try {
      const { companyId, batchId } = req.params;
      const result = await payrollService.submitForApproval(companyId, batchId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async approveBatch(req, res, next) {
    try {
      const { companyId, batchId } = req.params;
      const result = await payrollService.approveBatch(companyId, batchId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async postToGeneralLedger(req, res, next) {
    try {
      const { companyId, batchId } = req.params;
      const result = await payrollService.postToGeneralLedger(companyId, batchId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async generateDisbursementCsv(req, res, next) {
    try {
      const { companyId, batchId } = req.params;
      const result = await payrollService.generateDisbursementCsv(companyId, batchId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="disbursement_${result.batchNumber}.csv"`);
      res.send(result.csvContent);
    } catch (err) {
      next(err);
    }
  },

  async markAsDisbursed(req, res, next) {
    try {
      const { companyId, batchId } = req.params;
      const result = await payrollService.markAsDisbursed(companyId, batchId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listBatches(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await payrollService.listBatches(companyId, req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getBatchById(req, res, next) {
    try {
      const { companyId, batchId } = req.params;
      const result = await payrollService.getBatchById(companyId, batchId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Payslips
  async getPayslipByToken(req, res, next) {
    try {
      const { token } = req.params;
      const result = await payslipService.getPayslipByToken(token);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getEmployeePayslips(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await payslipService.getEmployeePayslips(companyId, profileId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getPayslipHtml(req, res, next) {
    try {
      const { companyId, payslipId } = req.params;
      const html = await payslipService.getPayslipHtml(companyId, payslipId, req.user);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      next(err);
    }
  },
};

export default payrollController;

