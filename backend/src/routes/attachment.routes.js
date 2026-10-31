import { Router } from 'express';
import { requireAuth, validateCompanyAccess } from '../middlewares/auth.middleware.js';
import attachmentController from '../controllers/attachment.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/companies/:companyId/attachments/:entityType/:entityId',
  validateCompanyAccess,
  attachmentController.list
);

router.post(
  '/companies/:companyId/attachments/:entityType/:entityId',
  validateCompanyAccess,
  attachmentController.uploadMiddleware,
  attachmentController.upload
);

router.get(
  '/companies/:companyId/attachments/download/:attachmentId',
  validateCompanyAccess,
  attachmentController.download
);

router.delete(
  '/companies/:companyId/attachments/:attachmentId',
  validateCompanyAccess,
  attachmentController.delete
);

export default router;

