import { Router } from 'express';
import auditMetaMiddleware from '../middlewares/auditMeta.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import authRoutes from './auth.routes.js';
import systemRoutes from './system.routes.js';
import catalogRoutes from './catalog.routes.js';
import companyRoutes from './company.routes.js';
import departmentRoutes from './department.routes.js';
import auditRoutes from './audit.routes.js';
import inventoryRoutes from './inventory.routes.js';
import purchaseRoutes from './purchase.routes.js';

import { publicWebhookRouter, protectedIntegrationRouter } from './lead-integration.routes.js';

const router = Router();

// Automatically attach IP & UserAgent metadata to all incoming API requests
router.use(auditMetaMiddleware);

// Public routes: Auth, System health, and Inbound Lead Webhooks
router.use(authRoutes);
router.use(systemRoutes);
router.use(publicWebhookRouter);

// Every application API below this point requires a valid bearer token or session cookie.
router.use(requireAuth);
router.use(catalogRoutes);
router.use(companyRoutes);
router.use(inventoryRoutes);
router.use(purchaseRoutes);
router.use(departmentRoutes);
router.use(auditRoutes);
router.use(protectedIntegrationRouter);

export default router;
