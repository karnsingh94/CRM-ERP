import voucherService from '../../services/accounting/voucher.service.js';

export const voucherController = {
  async createDraftVoucher(req, res, next) {
    try {
      const { companyId } = req.params;
      const voucher = await voucherService.createDraftVoucher(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  },

  async updateDraftVoucher(req, res, next) {
    try {
      const { companyId, voucherId } = req.params;
      const voucher = await voucherService.updateDraftVoucher(companyId, voucherId, req.body, req.user);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  },

  async validateVoucher(req, res, next) {
    try {
      const { companyId, voucherId } = req.params;
      const result = await voucherService.validateVoucherForPosting(companyId, voucherId);
      res.json({
        success: true,
        data: {
          isValid: result.isValid,
          totalDebit: Number(result.totalDebit),
          totalCredit: Number(result.totalCredit),
          itemsCount: result.voucher.items.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async postVoucher(req, res, next) {
    try {
      const { companyId, voucherId } = req.params;
      const voucher = await voucherService.postVoucher(companyId, voucherId, req.user);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  },

  async cancelDraftVoucher(req, res, next) {
    try {
      const { companyId, voucherId } = req.params;
      const { reason } = req.body;
      const voucher = await voucherService.cancelDraftVoucher(companyId, voucherId, reason, req.user);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  },

  async reversePostedVoucher(req, res, next) {
    try {
      const { companyId, voucherId } = req.params;
      const { reason } = req.body;
      const reversalVoucher = await voucherService.reversePostedVoucher(companyId, voucherId, reason, req.user);
      res.status(201).json({ success: true, data: reversalVoucher });
    } catch (err) {
      next(err);
    }
  },

  async listVouchers(req, res, next) {
    try {
      const { companyId } = req.params;
      const vouchers = await voucherService.listVouchers(companyId, req.query);
      res.json({ success: true, data: vouchers });
    } catch (err) {
      next(err);
    }
  },

  async getVoucherById(req, res, next) {
    try {
      const { companyId, voucherId } = req.params;
      const voucher = await voucherService.getVoucherById(companyId, voucherId);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  },
};

export default voucherController;

