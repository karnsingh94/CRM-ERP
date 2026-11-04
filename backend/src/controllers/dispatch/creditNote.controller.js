import creditNoteService from '../../services/dispatch/creditNote.service.js';

function handleError(error, res, next) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const creditNoteController = {
  async getDashboard(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await creditNoteService.getDashboard(companyId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async createCreditNote(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await creditNoteService.createCreditNote(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async listCreditNotes(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await creditNoteService.listCreditNotes(companyId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getCreditNoteById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const creditNoteId = String(req.params.creditNoteId);
      const data = await creditNoteService.getCreditNoteById(companyId, creditNoteId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async approveCreditNote(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const creditNoteId = String(req.params.creditNoteId);
      const data = await creditNoteService.approveCreditNote(companyId, creditNoteId, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async applyCreditNote(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const creditNoteId = String(req.params.creditNoteId);
      const data = await creditNoteService.applyCreditNote(companyId, creditNoteId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },
};

export default creditNoteController;

