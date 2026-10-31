import { Router } from 'express';
import { requireAuth, validateCompanyAccess } from '../middlewares/auth.middleware.js';
import integrationJobController from '../controllers/integrationJob.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/companies/:companyId/integrations/jobs',
  validateCompanyAccess,
  integrationJobController.listJobs
);

router.post(
  '/companies/:companyId/integrations/jobs',
  validateCompanyAccess,
  integrationJobController.enqueue
);

router.post(
  '/companies/:companyId/integrations/jobs/:jobId/retry',
  validateCompanyAccess,
  integrationJobController.retry
);

router.post(
  '/companies/:companyId/integrations/process-now',
  validateCompanyAccess,
  integrationJobController.triggerWorkerRun
);

export default router;

