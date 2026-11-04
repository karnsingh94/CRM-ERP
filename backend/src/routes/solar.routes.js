import { Router } from 'express';
import { requireAuth, validateCompanyAccess } from '../middlewares/auth.middleware.js';
import solarPlantController from '../controllers/solar/solarPlant.controller.js';
import solarTelemetryController from '../controllers/solar/solarTelemetry.controller.js';
import solarAnalyticsController from '../controllers/solar/solarAnalytics.controller.js';
import solarOperationsController from '../controllers/solar/solarOperations.controller.js';

// =========================================================================
// 1. PUBLIC WEBHOOK ROUTER (Unauthenticated, validated via webhookToken in URL)
// =========================================================================
export const solarWebhookRouter = Router();

solarWebhookRouter.post(
  '/solar/webhooks/:plantId/:webhookToken',
  solarTelemetryController.handleWebhook
);

// =========================================================================
// 2. PROTECTED SOLAR MONITORING ROUTER (Multi-tenant scoped)
// =========================================================================
export const solarProtectedRouter = Router();

solarProtectedRouter.use(requireAuth);

const companyPrefix = '/companies/:companyId/solar';

// --- Solar Plants ---
solarProtectedRouter.get(
  `${companyPrefix}/plants`,
  validateCompanyAccess,
  solarPlantController.listPlants
);

solarProtectedRouter.post(
  `${companyPrefix}/plants`,
  validateCompanyAccess,
  solarPlantController.createPlant
);

solarProtectedRouter.get(
  `${companyPrefix}/plants/:plantId`,
  validateCompanyAccess,
  solarPlantController.getPlantById
);

solarProtectedRouter.put(
  `${companyPrefix}/plants/:plantId`,
  validateCompanyAccess,
  solarPlantController.updatePlant
);

// --- Inverters ---
solarProtectedRouter.get(
  `${companyPrefix}/inverters`,
  validateCompanyAccess,
  solarPlantController.listInverters
);

solarProtectedRouter.get(
  `${companyPrefix}/plants/:plantId/inverters`,
  validateCompanyAccess,
  solarPlantController.listInverters
);

solarProtectedRouter.post(
  `${companyPrefix}/plants/:plantId/inverters`,
  validateCompanyAccess,
  solarPlantController.createInverter
);

solarProtectedRouter.get(
  `${companyPrefix}/inverters/:inverterId`,
  validateCompanyAccess,
  solarPlantController.getInverterById
);

solarProtectedRouter.put(
  `${companyPrefix}/inverters/:inverterId`,
  validateCompanyAccess,
  solarPlantController.updateInverter
);

// --- Panel Strings ---
solarProtectedRouter.get(
  `${companyPrefix}/plants/:plantId/strings`,
  validateCompanyAccess,
  solarPlantController.listPanelStrings
);

solarProtectedRouter.post(
  `${companyPrefix}/plants/:plantId/strings`,
  validateCompanyAccess,
  solarPlantController.createPanelString
);

solarProtectedRouter.put(
  `${companyPrefix}/strings/:stringId`,
  validateCompanyAccess,
  solarPlantController.updatePanelString
);

// --- API Configuration ---
solarProtectedRouter.get(
  `${companyPrefix}/plants/:plantId/api-config`,
  validateCompanyAccess,
  solarTelemetryController.getPlantConfig
);

solarProtectedRouter.post(
  `${companyPrefix}/plants/:plantId/api-config`,
  validateCompanyAccess,
  solarTelemetryController.savePlantConfig
);

solarProtectedRouter.post(
  `${companyPrefix}/plants/:plantId/api-config/test`,
  validateCompanyAccess,
  solarTelemetryController.testConnection
);

// --- Telemetry Ingestion & History ---
solarProtectedRouter.post(
  `${companyPrefix}/plants/:plantId/telemetry/ingest`,
  validateCompanyAccess,
  solarTelemetryController.ingestTelemetry
);

solarProtectedRouter.get(
  `${companyPrefix}/plants/:plantId/telemetry/latest`,
  validateCompanyAccess,
  solarTelemetryController.getLatestSnapshot
);

solarProtectedRouter.get(
  `${companyPrefix}/plants/:plantId/telemetry/history`,
  validateCompanyAccess,
  solarTelemetryController.getTelemetryHistory
);

// --- Yield Analytics ---
solarProtectedRouter.get(
  `${companyPrefix}/plants/:plantId/analytics/yield`,
  validateCompanyAccess,
  solarAnalyticsController.getYieldAnalytics
);

solarProtectedRouter.get(
  `${companyPrefix}/plants/:plantId/analytics/inverters`,
  validateCompanyAccess,
  solarAnalyticsController.getInverterComparison
);

// --- Alarms ---
solarProtectedRouter.get(
  `${companyPrefix}/alarms`,
  validateCompanyAccess,
  solarOperationsController.listAlarms
);

solarProtectedRouter.post(
  `${companyPrefix}/alarms`,
  validateCompanyAccess,
  solarOperationsController.raiseAlarm
);

solarProtectedRouter.put(
  `${companyPrefix}/alarms/:alarmId/acknowledge`,
  validateCompanyAccess,
  solarOperationsController.acknowledgeAlarm
);

solarProtectedRouter.put(
  `${companyPrefix}/alarms/:alarmId/resolve`,
  validateCompanyAccess,
  solarOperationsController.resolveAlarm
);

// --- Cleaning Schedules ---
solarProtectedRouter.get(
  `${companyPrefix}/cleaning`,
  validateCompanyAccess,
  solarOperationsController.listCleaningSchedules
);

solarProtectedRouter.post(
  `${companyPrefix}/cleaning`,
  validateCompanyAccess,
  solarOperationsController.createCleaningSchedule
);

solarProtectedRouter.put(
  `${companyPrefix}/cleaning/:scheduleId/complete`,
  validateCompanyAccess,
  solarOperationsController.completeCleaningCycle
);

// --- Maintenance Tickets ---
solarProtectedRouter.get(
  `${companyPrefix}/tickets`,
  validateCompanyAccess,
  solarOperationsController.listTickets
);

solarProtectedRouter.post(
  `${companyPrefix}/tickets`,
  validateCompanyAccess,
  solarOperationsController.createTicket
);

solarProtectedRouter.get(
  `${companyPrefix}/tickets/:ticketId`,
  validateCompanyAccess,
  solarOperationsController.getTicketById
);

solarProtectedRouter.put(
  `${companyPrefix}/tickets/:ticketId`,
  validateCompanyAccess,
  solarOperationsController.updateTicket
);

// --- O&M Spares Inventory Issue (Phase 4 Inventory Integration) ---
solarProtectedRouter.post(
  `${companyPrefix}/tickets/:ticketId/issue-spares`,
  validateCompanyAccess,
  solarOperationsController.issueSpares
);

export default {
  solarWebhookRouter,
  solarProtectedRouter,
};

