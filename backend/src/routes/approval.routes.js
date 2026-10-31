import { Router } from 'express';
import { requireAuth, validateCompanyAccess } from '../middlewares/auth.middleware.js';
import { requireAction } from '../middlewares/actionPermission.middleware.js';
import approvalController from '../controllers/approval.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/companies/:companyId/approvals',
  validateCompanyAccess,
  approvalController.listRequests
);

router.get(
  '/companies/:companyId/approvals/:requestId',
  validateCompanyAccess,
  approvalController.getRequest
);

router.post(
  '/companies/:companyId/approvals/request',
  validateCompanyAccess,
  approvalController.submitRequest
);

router.post(
  '/companies/:companyId/approvals/:requestId/decision',
  validateCompanyAccess,
  requireAction('APPROVE'),
  approvalController.recordDecision
);

export default router;

