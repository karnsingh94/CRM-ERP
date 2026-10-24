import leadIntegrationService from '../services/lead-integration.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const leadIntegrationController = {
  async getSupportedProviders(req, res, next) {
    try {
      const providers = leadIntegrationService.getSupportedProviders();
      res.json({ success: true, data: providers });
    } catch (error) {
      respondError(error, res, next);
    }
  },

  async getCompanyIntegrations(req, res, next) {
    try {
      const companyId = req.params.companyId || req.params.id;
      const integrations = await leadIntegrationService.getCompanyIntegrations(companyId);
      res.json({ success: true, data: integrations });
    } catch (error) {
      respondError(error, res, next);
    }
  },

  async saveCompanyIntegration(req, res, next) {
    try {
      // Security: Only Super Admin has permission to provision or modify external lead channel credentials
      if (req.user && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: External Lead API channels and credentials can only be configured by Super Admin.',
        });
      }

      const companyId = req.params.companyId || req.params.id;
      const providerId = req.params.providerId;
      const result = await leadIntegrationService.saveCompanyIntegration(
        companyId,
        providerId,
        req.body || {}
      );
      res.json(result);
    } catch (error) {
      respondError(error, res, next);
    }
  },

  async syncIndiaMart(req, res, next) {
    try {
      const companyId = req.params.companyId || req.params.id;
      const result = await leadIntegrationService.syncIndiaMart(companyId);
      res.json(result);
    } catch (error) {
      respondError(error, res, next);
    }
  },

  /**
   * Public Webhook Receiver: POST /api/webhooks/leads/:token
   */
  async handlePublicWebhook(req, res, next) {
    try {
      const { token } = req.params;
      const result = await leadIntegrationService.ingestWebhookLead(token, req.body, req.meta || {});
      res.status(201).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  },

  /**
   * Meta Webhook Hub Challenge (GET /api/webhooks/leads/:token)
   */
  async handleMetaWebhookVerification(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(200).json({ success: true, status: 'Webhook endpoint active' });
  },
};

export default leadIntegrationController;
