import receiptService from '../../services/accounting/receipt.service.js';

export const receiptController = {
  async createReceipt(req, res) {
    try {
      const { companyId } = req.params;
      const receipt = await receiptService.createReceipt(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data: receipt });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async getReceiptById(req, res) {
    try {
      const { companyId, receiptId } = req.params;
      const receipt = await receiptService.getReceiptById(companyId, receiptId);
      return res.status(200).json({ success: true, data: receipt });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async listReceipts(req, res) {
    try {
      const { companyId } = req.params;
      const result = await receiptService.listReceipts(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },
};

export default receiptController;

