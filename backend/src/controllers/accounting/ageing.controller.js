import ageingService from '../../services/accounting/ageing.service.js';

export const ageingController = {
  async getCustomerAgeing(req, res) {
    try {
      const { companyId } = req.params;
      const { customerId, asOfDate } = req.query;
      const data = await ageingService.getCustomerAgeing(companyId, customerId, asOfDate);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async getVendorAgeing(req, res) {
    try {
      const { companyId } = req.params;
      const { vendorId, asOfDate } = req.query;
      const data = await ageingService.getVendorAgeing(companyId, vendorId, asOfDate);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async getCustomerStatement(req, res) {
    try {
      const { companyId, customerId } = req.params;
      const { fromDate, toDate } = req.query;
      const data = await ageingService.getCustomerStatement(companyId, customerId, fromDate, toDate);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async getVendorStatement(req, res) {
    try {
      const { companyId, vendorId } = req.params;
      const { fromDate, toDate } = req.query;
      const data = await ageingService.getVendorStatement(companyId, vendorId, fromDate, toDate);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },
};

export default ageingController;

