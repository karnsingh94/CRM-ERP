import coaService from '../../services/accounting/coa.service.js';

export const coaController = {
  // Account Groups
  async createGroup(req, res, next) {
    try {
      const { companyId } = req.params;
      const group = await coaService.createGroup(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: group });
    } catch (err) {
      next(err);
    }
  },

  async updateGroup(req, res, next) {
    try {
      const { companyId, groupId } = req.params;
      const group = await coaService.updateGroup(companyId, groupId, req.body, req.user);
      res.json({ success: true, data: group });
    } catch (err) {
      next(err);
    }
  },

  async listGroups(req, res, next) {
    try {
      const { companyId } = req.params;
      const groups = await coaService.listGroups(companyId, req.query);
      res.json({ success: true, data: groups });
    } catch (err) {
      next(err);
    }
  },

  async getGroupById(req, res, next) {
    try {
      const { companyId, groupId } = req.params;
      const group = await coaService.getGroupById(companyId, groupId);
      res.json({ success: true, data: group });
    } catch (err) {
      next(err);
    }
  },

  // Account Masters
  async createAccount(req, res, next) {
    try {
      const { companyId } = req.params;
      const account = await coaService.createAccount(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  },

  async updateAccount(req, res, next) {
    try {
      const { companyId, accountId } = req.params;
      const account = await coaService.updateAccount(companyId, accountId, req.body, req.user);
      res.json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  },

  async listAccounts(req, res, next) {
    try {
      const { companyId } = req.params;
      const accounts = await coaService.listAccounts(companyId, req.query);
      res.json({ success: true, data: accounts });
    } catch (err) {
      next(err);
    }
  },

  async getAccountById(req, res, next) {
    try {
      const { companyId, accountId } = req.params;
      const account = await coaService.getAccountById(companyId, accountId);
      res.json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  },

  async toggleAccountStatus(req, res, next) {
    try {
      const { companyId, accountId } = req.params;
      const result = await coaService.toggleAccountStatus(companyId, accountId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteAccount(req, res, next) {
    try {
      const { companyId, accountId } = req.params;
      const result = await coaService.deleteAccount(companyId, accountId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default coaController;

