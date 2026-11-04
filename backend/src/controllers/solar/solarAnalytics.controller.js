import solarAnalyticsService from '../../services/solar/solarAnalytics.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const solarAnalyticsController = {
  async getYieldAnalytics(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const analytics = await solarAnalyticsService.getYieldAnalytics(
        companyId,
        req.params.plantId,
        req.query
      );
      res.json({ success: true, data: analytics });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getInverterComparison(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const { startDate, endDate } = req.query;
      const comparison = await solarAnalyticsService.getInverterWiseComparison(
        companyId,
        req.params.plantId,
        startDate,
        endDate
      );
      res.json({ success: true, data: comparison });
    } catch (err) {
      respondError(err, res, next);
    }
  },
};

export default solarAnalyticsController;

