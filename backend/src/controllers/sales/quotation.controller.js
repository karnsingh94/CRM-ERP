import quotationService from '../../services/sales/quotation.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const quotationController = {
  async list(req, res, next) {
    try {
      const data = await quotationService.listQuotations(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async create(req, res, next) {
    try {
      const data = await quotationService.createQuotation(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async updateStatus(req, res, next) {
    try {
      const data = await quotationService.updateQuotationStatus(
        String(req.params.companyId),
        String(req.params.quoteId),
        req.body?.status
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async convertToOrder(req, res, next) {
    try {
      const data = await quotationService.convertQuotationToOrder(
        String(req.params.companyId),
        String(req.params.quoteId)
      );
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async remove(req, res, next) {
    try {
      await quotationService.removeQuotation(String(req.params.companyId), req.params.quoteId);
      res.json({ success: true, message: 'Quotation deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  async submitForApproval(req, res, next) {
    try {
      const data = await quotationService.submitForApproval(
        String(req.params.companyId),
        String(req.params.quoteId),
        req.user || {}
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async revise(req, res, next) {
    try {
      const data = await quotationService.reviseQuotation(
        String(req.params.companyId),
        String(req.params.quoteId),
        req.body || {},
        req.user || {}
      );
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
};

export default quotationController;
