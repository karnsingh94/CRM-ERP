import allocationService from '../../services/accounting/allocation.service.js';

export const allocationController = {
  async allocatePayment(req, res) {
    try {
      const { companyId } = req.params;
      const allocation = await allocationService.allocatePayment(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data: allocation });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async reverseAllocation(req, res) {
    try {
      const { companyId, allocationId } = req.params;
      const { reason } = req.body;
      const allocation = await allocationService.reverseAllocation(companyId, allocationId, reason, req.user);
      return res.status(200).json({ success: true, data: allocation });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },

  async listAllocations(req, res) {
    try {
      const { companyId } = req.params;
      const allocations = await allocationService.listAllocations(companyId, req.query);
      return res.status(200).json({ success: true, data: allocations });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  },
};

export default allocationController;

