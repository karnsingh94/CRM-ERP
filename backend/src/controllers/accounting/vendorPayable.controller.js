import vendorPayableService from '../../services/accounting/vendorPayable.service.js';

export const vendorPayableController = {
  async listVendorBills(req, res) {
    try {
      const { companyId } = req.params;
      const result = await vendorPayableService.listVendorBills(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async getVendorBillDetails(req, res) {
    try {
      const { companyId, billId } = req.params;
      const bill = await vendorPayableService.getVendorBillDetails(companyId, billId);
      return res.status(200).json({ success: true, data: bill });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async postPurchaseBill(req, res) {
    try {
      const { companyId, billId } = req.params;
      const voucher = await vendorPayableService.postPurchaseBill(companyId, billId, req.user);
      return res.status(200).json({ success: true, data: voucher });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async recordVendorPayment(req, res) {
    try {
      const { companyId } = req.params;
      const payment = await vendorPayableService.recordVendorPayment(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data: payment });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async createVendorDebitNote(req, res) {
    try {
      const { companyId } = req.params;
      const debitNote = await vendorPayableService.createVendorDebitNote(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data: debitNote });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },
};

export default vendorPayableController;

