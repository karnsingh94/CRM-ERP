import bankReportService from '../../services/accounting/bankReport.service.js';

export const bankReportController = {
  async getBankBook(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankReportService.getBankBook(companyId, bankAccountId, req.query);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getBankReconciliationStatement(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankReportService.getBankReconciliationStatement(companyId, bankAccountId, req.query);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getUnreconciledTransactions(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankReportService.getUnreconciledTransactions(companyId, bankAccountId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getBankChargesAndInterestSummary(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankReportService.getBankChargesAndInterestSummary(companyId, bankAccountId, req.query);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default bankReportController;

