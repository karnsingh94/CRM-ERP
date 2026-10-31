import advanceService from '../../services/sales/advance.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const advanceController = {
  async list(req, res, next) {
    try {
      const data = await advanceService.listAdvances(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async record(req, res, next) {
    try {
      const data = await advanceService.recordAdvance(
        String(req.params.companyId),
        req.body || {},
        req.user || {}
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async verify(req, res, next) {
    try {
      const data = await advanceService.verifyAdvance(
        String(req.params.companyId),
        String(req.params.advanceId),
        req.body || {},
        req.user || {}
      );
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },
};

export default advanceController;

