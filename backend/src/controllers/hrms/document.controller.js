import documentService from '../../services/hrms/document.service.js';

export const documentController = {
  async uploadDocument(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await documentService.uploadDocument(companyId, profileId, req.body, req.file, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listDocuments(req, res, next) {
    try {
      const { companyId, profileId } = req.params;
      const result = await documentService.listDocuments(companyId, profileId, req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getDocumentById(req, res, next) {
    try {
      const { companyId, documentId } = req.params;
      const result = await documentService.getDocumentById(companyId, documentId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async verifyDocument(req, res, next) {
    try {
      const { companyId, documentId } = req.params;
      const result = await documentService.verifyDocument(companyId, documentId, req.body, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteDocument(req, res, next) {
    try {
      const { companyId, documentId } = req.params;
      const result = await documentService.deleteDocument(companyId, documentId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getExpiringDocuments(req, res, next) {
    try {
      const { companyId } = req.params;
      const days = req.query.days || 30;
      const result = await documentService.getExpiringDocuments(companyId, days);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default documentController;

