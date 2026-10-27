import opportunityService from '../../services/crm/opportunity.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const opportunityController = {
  async list(req, res, next) {
    try {
      const data = await opportunityService.listOpportunities(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async create(req, res, next) {
    try {
      const data = await opportunityService.createOpportunity(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async update(req, res, next) {
    try {
      const data = await opportunityService.updateOpportunity(
        String(req.params.companyId),
        String(req.params.opportunityId),
        req.body || {}
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async remove(req, res, next) {
    try {
      await opportunityService.removeOpportunity(String(req.params.companyId), req.params.opportunityId);
      res.json({ success: true, message: 'Opportunity deleted.' });
    } catch (err) { respondError(err, res, next); }
  },
};

export default opportunityController;
