import customerService from '../../services/crm/customer.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const customerController = {
  async list(req, res, next) {
    try {
      const data = await customerService.listCustomers(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async create(req, res, next) {
    try {
      const data = await customerService.createCustomer(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async update(req, res, next) {
    try {
      const data = await customerService.updateCustomer(
        String(req.params.companyId),
        String(req.params.customerId),
        req.body || {}
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async remove(req, res, next) {
    try {
      await customerService.removeCustomer(String(req.params.companyId), req.params.customerId);
      res.json({ success: true, message: 'Customer deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  async getTimeline(req, res, next) {
    try {
      const data = await customerService.getCustomerTimeline(
        String(req.params.companyId),
        String(req.params.customerId)
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
};

export default customerController;
