import salesInvoiceService from '../../services/accounting/salesInvoice.service.js';

export const salesInvoiceController = {
  async createInvoice(req, res) {
    try {
      const { companyId } = req.params;
      const invoice = await salesInvoiceService.createDraftInvoice(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data: invoice });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async updateInvoice(req, res) {
    try {
      const { companyId, invoiceId } = req.params;
      const invoice = await salesInvoiceService.updateDraftInvoice(companyId, invoiceId, req.body, req.user);
      return res.status(200).json({ success: true, data: invoice });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async getInvoiceById(req, res) {
    try {
      const { companyId, invoiceId } = req.params;
      const invoice = await salesInvoiceService.getInvoiceById(companyId, invoiceId);
      return res.status(200).json({ success: true, data: invoice });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async listInvoices(req, res) {
    try {
      const { companyId } = req.params;
      const result = await salesInvoiceService.listInvoices(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async postInvoice(req, res) {
    try {
      const { companyId, invoiceId } = req.params;
      const invoice = await salesInvoiceService.postInvoice(companyId, invoiceId, req.user);
      return res.status(200).json({ success: true, data: invoice });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async cancelInvoice(req, res) {
    try {
      const { companyId, invoiceId } = req.params;
      const { reason } = req.body;
      const invoice = await salesInvoiceService.cancelInvoice(companyId, invoiceId, reason, req.user);
      return res.status(200).json({ success: true, data: invoice });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },
};

export default salesInvoiceController;

