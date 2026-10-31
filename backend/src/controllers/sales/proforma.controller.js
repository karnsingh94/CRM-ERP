import proformaService from '../../services/sales/proforma.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const proformaController = {
  async list(req, res, next) {
    try {
      const data = await proformaService.listProformas(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async create(req, res, next) {
    try {
      const data = await proformaService.createProforma(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async updateStatus(req, res, next) {
    try {
      const data = await proformaService.updateProformaStatus(
        String(req.params.companyId),
        String(req.params.proformaId),
        req.body?.status
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async remove(req, res, next) {
    try {
      await proformaService.removeProforma(String(req.params.companyId), req.params.proformaId);
      res.json({ success: true, message: 'Proforma deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  async submitForApproval(req, res, next) {
    try {
      const data = await proformaService.submitForApproval(
        String(req.params.companyId),
        String(req.params.proformaId),
        req.user || {}
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async revise(req, res, next) {
    try {
      const data = await proformaService.reviseProforma(
        String(req.params.companyId),
        String(req.params.proformaId),
        req.body || {},
        req.user || {}
      );
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
};

export default proformaController;
