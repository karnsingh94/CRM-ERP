import { Router } from 'express';
import catalogController from '../controllers/catalog.controller.js';

const router = Router();

// ==================== SERVICES ====================
router.get('/services', catalogController.getServices);
router.post('/services', catalogController.createService);
router.get('/services/:id', catalogController.getServiceById);
router.put('/services/:id', catalogController.updateService);
router.patch('/services/:id/status', catalogController.toggleServiceStatus);

// ==================== MODULES ====================
router.post('/services/:serviceId/modules', catalogController.createModule);
router.put('/modules/:id', catalogController.updateModule);
router.patch('/modules/:id/status', catalogController.toggleModuleStatus);

// ==================== SUB-MODULES ====================
router.post('/modules/:moduleId/sub-modules', catalogController.createSubModule);
router.put('/sub-modules/:id', catalogController.updateSubModule);
router.patch('/sub-modules/:id/status', catalogController.toggleSubModuleStatus);

export default router;
