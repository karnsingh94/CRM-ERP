import { Router } from 'express';
import auditMetaMiddleware from '../middlewares/auditMeta.middleware.js';
import authRoutes from './auth.routes.js';
import systemRoutes from './system.routes.js';
import catalogRoutes from './catalog.routes.js';
import companyRoutes from './company.routes.js';
import departmentRoutes from './department.routes.js';
import auditRoutes from './audit.routes.js';

const router = Router();

// Automatically attach IP & UserAgent metadata to all incoming API requests
router.use(auditMetaMiddleware);

// Feature Sub-routers
router.use(authRoutes);
router.use(systemRoutes);
router.use(catalogRoutes);
router.use(companyRoutes);
router.use(departmentRoutes);
router.use(auditRoutes);

export default router;
