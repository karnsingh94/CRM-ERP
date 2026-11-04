import solarApiConfigService from '../../services/solar/solarApiConfig.service.js';
import solarTelemetryService from '../../services/solar/solarTelemetry.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const solarTelemetryController = {
  // --- API Config ---
  async getPlantConfig(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const config = await solarApiConfigService.getPlantConfig(companyId, req.params.plantId);
      res.json({ success: true, data: config });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async savePlantConfig(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const config = await solarApiConfigService.savePlantConfig(companyId, req.params.plantId, req.body);
      res.json({ success: true, data: config, message: 'API configuration saved successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async testConnection(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const result = await solarApiConfigService.testConnection(companyId, req.params.plantId);
      res.json({ success: true, data: result });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // --- Telemetry Ingestion ---
  async ingestTelemetry(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const { readings, isSimulated, provider } = req.body;
      const rawList = Array.isArray(readings) ? readings : [req.body];

      const result = await solarTelemetryService.ingestTelemetryBatch(companyId, req.params.plantId, rawList, {
        isSimulated: Boolean(isSimulated),
        source: 'API_DIRECT',
        provider,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: `Ingested ${result.ingested} telemetry readings (${result.duplicates} duplicates ignored).`,
      });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // --- Public Webhook Ingestion ---
  async handleWebhook(req, res, next) {
    try {
      const { plantId, webhookToken } = req.params;
      const result = await solarTelemetryService.handleWebhookPush(
        plantId,
        webhookToken,
        req.headers,
        req.body
      );

      res.json({
        success: true,
        message: `Webhook accepted: Ingested ${result.ingested} readings.`,
        data: result,
      });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // --- Snapshots & History ---
  async getLatestSnapshot(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const snapshot = await solarTelemetryService.getLatestPlantSnapshot(companyId, req.params.plantId);
      res.json({ success: true, data: snapshot });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getTelemetryHistory(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const history = await solarTelemetryService.getTelemetryHistory(companyId, req.params.plantId, req.query);
      res.json({ success: true, data: history.logs, pagination: history.pagination });
    } catch (err) {
      respondError(err, res, next);
    }
  },
};

export default solarTelemetryController;

