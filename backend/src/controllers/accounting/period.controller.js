import periodService from '../../services/accounting/period.service.js';

export const periodController = {
  // Financial Year
  async createFinancialYear(req, res, next) {
    try {
      const { companyId } = req.params;
      const fy = await periodService.createFinancialYear(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: fy });
    } catch (err) {
      next(err);
    }
  },

  async listFinancialYears(req, res, next) {
    try {
      const { companyId } = req.params;
      const fys = await periodService.listFinancialYears(companyId);
      res.json({ success: true, data: fys });
    } catch (err) {
      next(err);
    }
  },

  async getFinancialYearById(req, res, next) {
    try {
      const { companyId, fyId } = req.params;
      const fy = await periodService.getFinancialYearById(companyId, fyId);
      res.json({ success: true, data: fy });
    } catch (err) {
      next(err);
    }
  },

  async setCurrentFinancialYear(req, res, next) {
    try {
      const { companyId, fyId } = req.params;
      const result = await periodService.setCurrentFinancialYear(companyId, fyId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async lockFinancialYear(req, res, next) {
    try {
      const { companyId, fyId } = req.params;
      const result = await periodService.lockFinancialYear(companyId, fyId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Accounting Periods
  async generateStandardPeriods(req, res, next) {
    try {
      const { companyId, fyId } = req.params;
      const periods = await periodService.generateStandardPeriods(companyId, fyId, req.user);
      res.status(201).json({ success: true, data: periods });
    } catch (err) {
      next(err);
    }
  },

  async createPeriod(req, res, next) {
    try {
      const { companyId } = req.params;
      const period = await periodService.createPeriod(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  },

  async listPeriods(req, res, next) {
    try {
      const { companyId } = req.params;
      const { financialYearId } = req.query;
      const periods = await periodService.listPeriods(companyId, financialYearId);
      res.json({ success: true, data: periods });
    } catch (err) {
      next(err);
    }
  },

  async getPeriodById(req, res, next) {
    try {
      const { companyId, periodId } = req.params;
      const period = await periodService.getPeriodById(companyId, periodId);
      res.json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  },

  async closePeriod(req, res, next) {
    try {
      const { companyId, periodId } = req.params;
      const result = await periodService.closePeriod(companyId, periodId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async reopenPeriod(req, res, next) {
    try {
      const { companyId, periodId } = req.params;
      const { reason } = req.body;
      const result = await periodService.reopenPeriod(companyId, periodId, reason, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default periodController;

