import communicationService from '../../services/crm/communication.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const communicationController = {
  async list(req, res, next) {
    try {
      const data = await communicationService.listCommunications(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async create(req, res, next) {
    try {
      const data = await communicationService.createCommunication(
        String(req.params.companyId),
        req.body || {},
        req.user || {}
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async processReorderReminders(req, res, next) {
    try {
      const data = await communicationService.processReorderCycleReminders(
        String(req.params.companyId),
        req.user || {}
      );
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },
};

export default communicationController;

