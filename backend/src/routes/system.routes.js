import { Router } from 'express';
import systemController from '../controllers/system.controller.js';

const router = Router();

router.get('/health', systemController.getHealth);
router.get('/db-status', systemController.getDbStatus);
router.get('/dashboard/stats', systemController.getStats);
router.get('/access-catalog', systemController.getFullCatalog);

export default router;
