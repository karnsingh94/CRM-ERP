import { Router } from 'express';
import systemController from '../controllers/system.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/health', systemController.getHealth);
router.get('/db-status', requireAuth, systemController.getDbStatus);
router.get('/dashboard/stats', requireAuth, systemController.getStats);
router.get('/access-catalog', requireAuth, systemController.getFullCatalog);

export default router;
