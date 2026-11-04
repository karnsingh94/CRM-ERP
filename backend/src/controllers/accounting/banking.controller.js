import bankAccountService from '../../services/accounting/bankAccount.service.js';
import bankStatementService from '../../services/accounting/bankStatement.service.js';

export const bankingController = {
  // Bank Account APIs
  async createBankAccount(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await bankAccountService.createBankAccount(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateBankAccount(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankAccountService.updateBankAccount(companyId, bankAccountId, req.body, req.user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listBankAccounts(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await bankAccountService.listBankAccounts(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getBankAccountById(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankAccountService.getBankAccountById(companyId, bankAccountId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async toggleAccountStatus(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const { status } = req.body;
      const result = await bankAccountService.toggleAccountStatus(companyId, bankAccountId, status, req.user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteBankAccount(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankAccountService.deleteBankAccount(companyId, bankAccountId, req.user);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getLedgerBalance(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankAccountService.getLedgerBalance(companyId, bankAccountId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getStatementBalance(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankAccountService.getStatementBalance(companyId, bankAccountId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getUnreconciledTransactionSummary(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankAccountService.getUnreconciledTransactionSummary(companyId, bankAccountId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Statement Import APIs
  async previewStatement(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const { statementData, columnMapping } = req.body;
      const result = await bankStatementService.previewStatement(companyId, bankAccountId, statementData, { columnMapping });
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async importStatement(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const { statementData, columnMapping, skipRejected } = req.body;
      const result = await bankStatementService.importStatement(companyId, bankAccountId, statementData, { columnMapping, skipRejected }, req.user);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listTransactions(req, res, next) {
    try {
      const { companyId, bankAccountId } = req.params;
      const result = await bankStatementService.listTransactions(companyId, bankAccountId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};

export default bankingController;

