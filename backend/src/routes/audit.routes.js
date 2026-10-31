import { Router } from 'express';
import { validateCompanyAccess } from '../middlewares/auth.middleware.js';
import auditController from '../controllers/audit.controller.js';

const router = Router();

// Platform-level audit logs (Super Admin)
router.get('/audit-logs', auditController.getAuditLogs);

// Company/tenant audit logs with filtering and before/after diffs
router.get('/companies/:companyId/audit-logs', validateCompanyAccess, auditController.getCompanyAuditLogs);

export default router;
