import { Router } from 'express';
import leadIntegrationController from '../controllers/lead-integration.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const publicWebhookRouter = Router();

// ==================== PUBLIC WEBHOOK INGESTION (NO AUTH REQUIRED) ====================
publicWebhookRouter.post('/webhooks/leads/:token', leadIntegrationController.handlePublicWebhook);
publicWebhookRouter.get('/webhooks/leads/:token', leadIntegrationController.handleMetaWebhookVerification);

export const protectedIntegrationRouter = Router();

// ==================== PROTECTED LEAD INTEGRATION APIs ====================
// Available to Super Admin and Authenticated Company users
protectedIntegrationRouter.get('/crm/lead-integrations/providers', leadIntegrationController.getSupportedProviders);

// Company routes
protectedIntegrationRouter.get(
  '/companies/:companyId/crm/lead-integrations',
  leadIntegrationController.getCompanyIntegrations
);
protectedIntegrationRouter.put(
  '/companies/:companyId/crm/lead-integrations/:providerId',
  leadIntegrationController.saveCompanyIntegration
);
protectedIntegrationRouter.post(
  '/companies/:companyId/crm/lead-integrations/sync-indiamart',
  leadIntegrationController.syncIndiaMart
);

// Client aliases for Super Admin management
protectedIntegrationRouter.get(
  '/clients/:id/crm/lead-integrations',
  leadIntegrationController.getCompanyIntegrations
);
protectedIntegrationRouter.put(
  '/clients/:id/crm/lead-integrations/:providerId',
  leadIntegrationController.saveCompanyIntegration
);
protectedIntegrationRouter.post(
  '/clients/:id/crm/lead-integrations/sync-indiamart',
  leadIntegrationController.syncIndiaMart
);

export default {
  publicWebhookRouter,
  protectedIntegrationRouter,
};
