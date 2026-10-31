import multer from 'multer';
import attachmentService from '../services/attachment.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

export const attachmentController = {
  uploadMiddleware: upload.single('file'),

  async upload(req, res, next) {
    try {
      const { companyId, entityType, entityId } = req.params;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
      }

      const attachment = await attachmentService.uploadAttachment(
        companyId,
        entityType,
        entityId,
        file,
        req.user
      );

      res.status(201).json({ success: true, data: attachment });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { companyId, entityType, entityId } = req.params;
      const list = await attachmentService.listAttachments(companyId, entityType, entityId);
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  },

  async download(req, res, next) {
    try {
      const { companyId, attachmentId } = req.params;
      const { stream, attachment } = await attachmentService.getAttachmentStream(companyId, attachmentId);

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
      stream.pipe(res);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const { companyId, attachmentId } = req.params;
      await attachmentService.deleteAttachment(companyId, attachmentId, req.user);
      res.json({ success: true, message: 'Attachment deleted successfully.' });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      next(err);
    }
  },
};

export default attachmentController;

