import prisma from '../../config/prisma.js';
import { encryptSensitive, decryptSensitive, generateSecureToken } from '../../utils/encryption.js';
import solarAdapterRegistry from './solarProviderAdapter.js';

export const solarApiConfigService = {
  /**
   * Mask sensitive string
   */
  maskSecret(val) {
    if (!val || typeof val !== 'string') return null;
    if (val.length <= 6) return '••••••••';
    return `${val.slice(0, 3)}••••••••${val.slice(-3)}`;
  },

  /**
   * Get API Configuration for a plant (returns masked credentials)
   */
  async getPlantConfig(companyId, plantId) {
    const config = await prisma.solarPlantApiConfig.findFirst({
      where: { plantId, companyId },
      include: {
        plant: { select: { id: true, name: true, code: true } },
      },
    });

    if (!config) {
      return {
        configured: false,
        plantId,
        provider: 'UNIVERSAL',
        status: 'INACTIVE',
      };
    }

    // Mask secrets
    const decryptedKey = decryptSensitive(config.encryptedApiKey);
    const decryptedSec = decryptSensitive(config.encryptedApiSecret);
    const decryptedToken = decryptSensitive(config.encryptedAccessToken);

    return {
      configured: true,
      id: config.id,
      plantId: config.plantId,
      plantName: config.plant?.name,
      plantCode: config.plant?.code,
      provider: config.provider,
      baseUrl: config.baseUrl,
      authType: config.authType,
      maskedApiKey: this.maskSecret(decryptedKey),
      maskedApiSecret: this.maskSecret(decryptedSec),
      maskedAccessToken: this.maskSecret(decryptedToken),
      tokenExpiresAt: config.tokenExpiresAt,
      pollingIntervalMinutes: config.pollingIntervalMinutes,
      isPollingEnabled: config.isPollingEnabled,
      lastPolledAt: config.lastPolledAt,
      webhookToken: config.webhookToken,
      webhookUrl: config.webhookToken ? `/api/solar/webhooks/${config.plantId}/${config.webhookToken}` : null,
      isWebhookEnabled: config.isWebhookEnabled,
      status: config.status,
      lastSyncStatus: config.lastSyncStatus,
      lastSyncError: config.lastSyncError,
      lastSyncAt: config.lastSyncAt,
      totalReadingsCount: Number(config.totalReadingsCount),
      extraConfigJson: config.extraConfigJson,
    };
  },

  /**
   * Save or update API configuration for a plant
   */
  async savePlantConfig(companyId, plantId, data) {
    // Verify plant belongs to company
    const plant = await prisma.solarPlant.findFirst({
      where: { id: plantId, companyId },
    });
    if (!plant) {
      const error = new Error('Plant not found or does not belong to your company.');
      error.statusCode = 404;
      throw error;
    }

    const provider = String(data.provider || 'UNIVERSAL').toUpperCase();
    const existing = await prisma.solarPlantApiConfig.findUnique({
      where: { plantId },
    });

    const updateData = {
      provider,
      baseUrl: data.baseUrl || existing?.baseUrl || null,
      authType: data.authType || existing?.authType || 'API_KEY',
      pollingIntervalMinutes: Number(data.pollingIntervalMinutes) || existing?.pollingIntervalMinutes || 15,
      isPollingEnabled: data.isPollingEnabled !== undefined ? Boolean(data.isPollingEnabled) : existing?.isPollingEnabled ?? false,
      isWebhookEnabled: data.isWebhookEnabled !== undefined ? Boolean(data.isWebhookEnabled) : existing?.isWebhookEnabled ?? true,
      extraConfigJson: data.extraConfigJson || existing?.extraConfigJson || null,
    };

    // Encrypt sensitive secrets if new values provided
    if (data.apiKey && !data.apiKey.includes('••••')) {
      updateData.encryptedApiKey = encryptSensitive(data.apiKey);
    }
    if (data.apiSecret && !data.apiSecret.includes('••••')) {
      updateData.encryptedApiSecret = encryptSensitive(data.apiSecret);
    }
    if (data.accessToken && !data.accessToken.includes('••••')) {
      updateData.encryptedAccessToken = encryptSensitive(data.accessToken);
    }
    if (data.refreshToken && !data.refreshToken.includes('••••')) {
      updateData.encryptedRefreshToken = encryptSensitive(data.refreshToken);
    }

    // Ensure webhook token exists
    if (!existing?.webhookToken) {
      updateData.webhookToken = `wh_solar_${generateSecureToken(16)}`;
      updateData.webhookSecret = generateSecureToken(24);
    }

    if (existing) {
      await prisma.solarPlantApiConfig.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      await prisma.solarPlantApiConfig.create({
        data: {
          companyId,
          plantId,
          ...updateData,
          status: 'ACTIVE',
        },
      });
    }

    return this.getPlantConfig(companyId, plantId);
  },

  /**
   * Test connection using registered provider adapter
   */
  async testConnection(companyId, plantId) {
    const config = await prisma.solarPlantApiConfig.findFirst({
      where: { plantId, companyId },
    });
    if (!config) {
      const error = new Error('No API configuration found for this plant.');
      error.statusCode = 404;
      throw error;
    }

    const adapter = solarAdapterRegistry.getAdapter(config.provider);
    const credentials = {
      authType: config.authType,
      apiKey: decryptSensitive(config.encryptedApiKey),
      apiSecret: decryptSensitive(config.encryptedApiSecret),
      accessToken: decryptSensitive(config.encryptedAccessToken),
      webhookToken: config.webhookToken,
    };

    const authResult = await adapter.authenticate(credentials, config.extraConfigJson || {});

    // Update sync status
    await prisma.solarPlantApiConfig.update({
      where: { id: config.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: authResult.success ? 'SUCCESS' : 'FAILED',
        lastSyncError: authResult.success ? null : (authResult.error || 'Connection failed'),
        status: authResult.success ? 'ACTIVE' : 'ERROR',
      },
    });

    return authResult;
  },

  /**
   * Internal helper: Retrieve decrypted credentials for background workers
   */
  async getDecryptedCredentials(plantId) {
    const config = await prisma.solarPlantApiConfig.findUnique({
      where: { plantId },
    });
    if (!config) return null;

    return {
      provider: config.provider,
      baseUrl: config.baseUrl,
      authType: config.authType,
      apiKey: decryptSensitive(config.encryptedApiKey),
      apiSecret: decryptSensitive(config.encryptedApiSecret),
      accessToken: decryptSensitive(config.encryptedAccessToken),
      refreshToken: decryptSensitive(config.encryptedRefreshToken),
      webhookToken: config.webhookToken,
      webhookSecret: config.webhookSecret,
      pollingIntervalMinutes: config.pollingIntervalMinutes,
      isPollingEnabled: config.isPollingEnabled,
      isWebhookEnabled: config.isWebhookEnabled,
      extraConfigJson: config.extraConfigJson,
    };
  },
};

export default solarApiConfigService;

