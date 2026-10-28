import pricingService from '../../services/crm/pricing.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const pricingController = {
  async list(req, res, next) {
    try {
      const data = await pricingService.listPricings(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async create(req, res, next) {
    try {
      const data = await pricingService.createPricing(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async update(req, res, next) {
    try {
      const data = await pricingService.updatePricing(String(req.params.companyId), req.params.pricingId, req.body || {});
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async remove(req, res, next) {
    try {
      await pricingService.removePricing(String(req.params.companyId), req.params.pricingId);
      res.json({ success: true, message: 'Price plan removed successfully.' });
    } catch (err) { respondError(err, res, next); }
  },
};

export default pricingController;

