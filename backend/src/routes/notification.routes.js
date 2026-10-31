import { Router } from 'express';
import { requireAuth, validateCompanyAccess } from '../middlewares/auth.middleware.js';
import notificationController from '../controllers/notification.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/companies/:companyId/notifications',
  validateCompanyAccess,
  notificationController.list
);

router.patch(
  '/companies/:companyId/notifications/:notificationId/read',
  validateCompanyAccess,
  notificationController.markRead
);

router.post(
  '/companies/:companyId/notifications/mark-all-read',
  validateCompanyAccess,
  notificationController.markAllRead
);

export default router;

