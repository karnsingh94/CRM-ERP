import reassignmentService from '../../services/crm/reassignment.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const reassignmentController = {
  async reassign(req, res, next) {
    try {
      const data = await reassignmentService.reassignSalesRepresentative(
        String(req.params.companyId),
        req.body || {},
        req.user || {}
      );
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },
};

export default reassignmentController;

