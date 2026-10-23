import crmLeadService from '../services/crm-lead.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const crmLeadController = {
  async list(req, res, next) {
    try {
      const leads = await crmLeadService.list(String(req.params.companyId));
      res.json({ success: true, data: leads });
    } catch (error) {
      respondError(error, res, next);
    }
  },

  async create(req, res, next) {
    try {
      const lead = await crmLeadService.create(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data: lead });
    } catch (error) {
      respondError(error, res, next);
    }
  },

  async update(req, res, next) {
    try {
      const lead = await crmLeadService.update(
        String(req.params.companyId),
        req.params.leadId,
        req.body || {}
      );
      res.json({ success: true, data: lead });
    } catch (error) {
      respondError(error, res, next);
    }
  },

  async remove(req, res, next) {
    try {
      await crmLeadService.remove(String(req.params.companyId), req.params.leadId);
      res.json({ success: true, message: 'Lead deleted.' });
    } catch (error) {
      respondError(error, res, next);
    }
  },
};

export default crmLeadController;
