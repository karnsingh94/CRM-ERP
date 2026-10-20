import { Router } from 'express';
import auditMetaMiddleware from '../middlewares/auditMeta.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import authRoutes from './auth.routes.js';
import systemRoutes from './system.routes.js';
import catalogRoutes from './catalog.routes.js';
import companyRoutes from './company.routes.js';
import departmentRoutes from './department.routes.js';
import auditRoutes from './audit.routes.js';

const router = Router();

// Automatically attach IP & UserAgent metadata to all incoming API requests
router.use(auditMetaMiddleware);

// Login, password recovery, health checks, and logout remain public.
router.use(authRoutes);
router.use(systemRoutes);

// Every application API below this point requires a valid bearer token or session cookie.
router.use(requireAuth);
router.use(catalogRoutes);
router.use(companyRoutes);
router.use(departmentRoutes);
router.use(auditRoutes);

export default router;
