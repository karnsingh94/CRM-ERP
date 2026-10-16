import { Router } from 'express';
import auditController from '../controllers/audit.controller.js';

const router = Router();

router.get('/audit-logs', auditController.getAuditLogs);

export default router;
