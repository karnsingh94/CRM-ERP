import logger from '../../utils/logger.js';

/**
 * Base Abstract Provider Adapter Interface
 * All manufacturer-specific solar adapters implement this interface.
 */
export class BaseSolarProviderAdapter {
  constructor(providerId, providerName) {
    this.providerId = providerId;
    this.providerName = providerName;
  }

  /**
   * Authenticate with the manufacturer API and return token/session metadata
   */
  async authenticate(credentials, extraConfig = {}) {
    throw new Error(`authenticate() not implemented for provider ${this.providerId}`);
  }

  /**
   * Refresh an expired OAuth or Bearer token
   */
  async refreshToken(refreshToken, credentials, extraConfig = {}) {
    throw new Error(`refreshToken() not implemented for provider ${this.providerId}`);
  }

  /**
   * Poll live/instantaneous telemetry from provider cloud
   */
  async pollTelemetry(plantConfig, inverters = []) {
    throw new Error(`pollTelemetry() not implemented for provider ${this.providerId}`);
  }

  /**
   * Parse vendor-specific telemetry payload into standard normalized telemetry
   */
  parseTelemetry(rawPayload) {
    throw new Error(`parseTelemetry() not implemented for provider ${this.providerId}`);
  }

  /**
   * Verify and parse incoming HTTP webhook payload
   */
  parseWebhook(headers, body, webhookSecret = null) {
    throw new Error(`parseWebhook() not implemented for provider ${this.providerId}`);
  }

  /**
   * Query historical time-series data for dates
   */
  async fetchHistoricalData(plantConfig, startDate, endDate, inverters = []) {
    throw new Error(`fetchHistoricalData() not implemented for provider ${this.providerId}`);
  }
}

/**
 * Universal & Standard Adapter (Default Open Format)
 * Accepts standard JSON payloads or universal webhook pushes.
 */
export class UniversalSolarAdapter extends BaseSolarProviderAdapter {
  constructor() {
    super('UNIVERSAL', 'Universal / Open Solar Telemetry');
  }

  async authenticate(credentials, extraConfig = {}) {
    // Universal adapter validates that either an API key, token, or webhook signature is provided
    if (!credentials.apiKey && !credentials.accessToken && !credentials.webhookToken) {
      return { success: false, error: 'At least one authentication credential (apiKey, accessToken, or webhookToken) is required.' };
    }
    return { success: true, authType: credentials.authType || 'API_KEY', connectedAt: new Date().toISOString() };
  }

  async refreshToken(refreshToken, credentials, extraConfig = {}) {
    return { success: true, refreshed: false, note: 'Static universal credentials do not require token refresh.' };
  }

  async pollTelemetry(plantConfig, inverters = []) {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      readings: [],
      note: 'Universal polling adapter: Configure manufacturer adapter once client API credentials are provided.',
    };
  }

  parseTelemetry(rawPayload) {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new Error('Invalid raw telemetry payload: Expected object.');
    }

    const parseNum = (val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    // Extract timestamp: parse ISO or epoch, fallback to now in UTC
    let timestamp = new Date();
    if (rawPayload.timestamp) {
      const parsed = new Date(rawPayload.timestamp);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed;
      }
    } else if (rawPayload.time) {
      const parsed = new Date(rawPayload.time);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed;
      }
    }

    return {
      inverterCode: rawPayload.inverterCode || rawPayload.inverter_code || rawPayload.sn || rawPayload.serialNumber || null,
      timestamp,
      currentPowerKw: parseNum(rawPayload.currentPowerKw ?? rawPayload.pac ?? rawPayload.active_power ?? rawPayload.powerKw ?? 0),
      dailyEnergyKwh: parseNum(rawPayload.dailyEnergyKwh ?? rawPayload.eToday ?? rawPayload.daily_yield ?? rawPayload.todayKwh ?? 0),
      totalEnergyKwh: parseNum(rawPayload.totalEnergyKwh ?? rawPayload.eTotal ?? rawPayload.total_yield ?? rawPayload.lifetimeKwh ?? 0),
      gridVoltageV: parseNum(rawPayload.gridVoltageV ?? rawPayload.vac ?? rawPayload.grid_voltage ?? rawPayload.voltage ?? null),
      gridCurrentA: parseNum(rawPayload.gridCurrentA ?? rawPayload.iac ?? rawPayload.grid_current ?? rawPayload.current ?? null),
      frequencyHz: parseNum(rawPayload.frequencyHz ?? rawPayload.fac ?? rawPayload.grid_frequency ?? 50.0),
      powerFactor: parseNum(rawPayload.powerFactor ?? rawPayload.pf ?? 1.0),
      dcPowerKw: parseNum(rawPayload.dcPowerKw ?? rawPayload.pdc ?? rawPayload.dc_power ?? null),
      dcVoltageV: parseNum(rawPayload.dcVoltageV ?? rawPayload.vdc ?? rawPayload.dc_voltage ?? null),
      dcCurrentA: parseNum(rawPayload.dcCurrentA ?? rawPayload.idc ?? rawPayload.dc_current ?? null),
      temperatureC: parseNum(rawPayload.temperatureC ?? rawPayload.temp ?? rawPayload.inverter_temp ?? null),
      irradianceWm2: parseNum(rawPayload.irradianceWm2 ?? rawPayload.ghi ?? rawPayload.poa ?? rawPayload.irradiation ?? null),
      ambientTempC: parseNum(rawPayload.ambientTempC ?? rawPayload.ambient_temp ?? null),
      inverterStatus: String(rawPayload.inverterStatus || rawPayload.status || 'NORMAL').toUpperCase(),
      isSimulated: Boolean(rawPayload.isSimulated || rawPayload.simulated),
      rawPayload,
    };
  }

  parseWebhook(headers, body, webhookSecret = null) {
    if (!body) {
      throw new Error('Empty webhook payload received.');
    }

    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    const readings = Array.isArray(payload) ? payload : (payload.readings || [payload]);

    return {
      isValid: true,
      readings: readings.map((r) => this.parseTelemetry(r)),
      receivedAt: new Date().toISOString(),
    };
  }

  async fetchHistoricalData(plantConfig, startDate, endDate, inverters = []) {
    return {
      success: true,
      readings: [],
      message: 'Awaiting client manufacturer API specification for historical sync.',
    };
  }
}

/**
 * Placeholder adapters for future manufacturers
 */
class GrowattPlaceholderAdapter extends UniversalSolarAdapter {
  constructor() {
    super();
    this.providerId = 'GROWATT';
    this.providerName = 'Growatt ShineServer API (Awaiting Client Specs)';
  }
}

class SolisPlaceholderAdapter extends UniversalSolarAdapter {
  constructor() {
    super();
    this.providerId = 'SOLIS';
    this.providerName = 'Solis / Ginlong Cloud API (Awaiting Client Specs)';
  }
}

class SungrowPlaceholderAdapter extends UniversalSolarAdapter {
  constructor() {
    super();
    this.providerId = 'SUNGROW';
    this.providerName = 'Sungrow iSolarCloud API (Awaiting Client Specs)';
  }
}

class HuaweiPlaceholderAdapter extends UniversalSolarAdapter {
  constructor() {
    super();
    this.providerId = 'HUAWEI';
    this.providerName = 'Huawei FusionSolar API (Awaiting Client Specs)';
  }
}

/**
 * Provider Adapter Registry
 */
const registry = new Map();
const universal = new UniversalSolarAdapter();

registry.set('UNIVERSAL', universal);
registry.set('UNIVERSAL_WEBHOOK', universal);
registry.set('GROWATT', new GrowattPlaceholderAdapter());
registry.set('SOLIS', new SolisPlaceholderAdapter());
registry.set('SUNGROW', new SungrowPlaceholderAdapter());
registry.set('HUAWEI', new HuaweiPlaceholderAdapter());

export const solarAdapterRegistry = {
  getAdapter(providerId) {
    if (!providerId) return universal;
    const normalized = String(providerId).toUpperCase().trim();
    return registry.get(normalized) || universal;
  },

  registerAdapter(providerId, adapterInstance) {
    if (!(adapterInstance instanceof BaseSolarProviderAdapter)) {
      throw new Error('Adapter must inherit from BaseSolarProviderAdapter');
    }
    registry.set(String(providerId).toUpperCase().trim(), adapterInstance);
    logger.info(`Solar Provider Adapter registered: ${providerId}`);
  },

  listSupportedProviders() {
    return Array.from(registry.entries()).map(([id, adapter]) => ({
      id,
      name: adapter.providerName,
    }));
  },
};

export default solarAdapterRegistry;

