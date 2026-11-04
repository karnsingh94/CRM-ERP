import dispatchTrackingService from '../../services/dispatch/dispatchTracking.service.js';

function handleError(error, res, next) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const dispatchTrackingController = {
  async addTrackingEvent(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchTrackingService.addTrackingEvent(companyId, orderId, req.body, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getTrackingHistory(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchTrackingService.getTrackingHistory(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async recordPOD(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchTrackingService.recordPOD(companyId, orderId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async recordFailedDelivery(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchTrackingService.recordFailedDelivery(companyId, orderId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },
};

export default dispatchTrackingController;

