import { Router } from 'express';
import { requireAuth, validateCompanyAccess } from '../middlewares/auth.middleware.js';
import versionController from '../controllers/version.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/companies/:companyId/versions/:entityType/:entityId',
  validateCompanyAccess,
  versionController.getHistory
);

router.get(
  '/companies/:companyId/versions/:entityType/:entityId/:versionNumber',
  validateCompanyAccess,
  versionController.getVersion
);

router.post(
  '/companies/:companyId/versions/:entityType/:entityId/branch',
  validateCompanyAccess,
  versionController.branchVersion
);

router.post(
  '/companies/:companyId/versions/:entityType/:entityId/:versionNumber/lock',
  validateCompanyAccess,
  versionController.lockVersion
);

export default router;

