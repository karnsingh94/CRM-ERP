import prisma from '../../config/prisma.js';
import solarAdapterRegistry from './solarProviderAdapter.js';
import logger from '../../utils/logger.js';

export const solarTelemetryService = {
  /**
   * Ingest a batch of telemetry records (used by webhooks, pollers, and simulated feeds)
   */
  async ingestTelemetryBatch(companyId, plantId, rawReadings = [], options = {}) {
    const { isSimulated = false, source = 'WEBHOOK' } = options;

    const plant = await prisma.solarPlant.findFirst({
      where: { id: plantId, companyId },
      include: { inverters: true },
    });
    if (!plant) {
      const error = new Error('Plant not found or does not belong to specified company.');
      error.statusCode = 404;
      throw error;
    }

    if (!Array.isArray(rawReadings) || rawReadings.length === 0) {
      return { ingested: 0, duplicates: 0, errors: [] };
    }

    // Build inverter lookup map (by inverterCode and serialNumber)
    const inverterMap = new Map();
    for (const inv of plant.inverters) {
      inverterMap.set(inv.inverterCode.toUpperCase(), inv);
      inverterMap.set(inv.serialNumber.toUpperCase(), inv);
      inverterMap.set(inv.id, inv);
    }

    const adapter = solarAdapterRegistry.getAdapter(options.provider || 'UNIVERSAL');
    let ingestedCount = 0;
    let duplicateCount = 0;
    const errors = [];

    for (const raw of rawReadings) {
      try {
        const normalized = adapter.parseTelemetry(raw);

        // Resolve inverter
        let matchedInverter = null;
        if (normalized.inverterCode) {
          matchedInverter = inverterMap.get(String(normalized.inverterCode).toUpperCase());
        }
        if (!matchedInverter && plant.inverters.length === 1) {
          // If plant only has 1 inverter, assign by default
          matchedInverter = plant.inverters[0];
        }

        if (!matchedInverter) {
          errors.push({
            inverterCode: normalized.inverterCode,
            error: 'Could not match telemetry to an active inverter in this plant.',
          });
          continue;
        }

        const timestampUtc = new Date(normalized.timestamp);
        if (isNaN(timestampUtc.getTime())) {
          errors.push({
            inverterCode: normalized.inverterCode,
            error: 'Invalid timestamp format.',
          });
          continue;
        }

        // Deduplication Check: [inverterId, timestamp]
        const existing = await prisma.solarTelemetryLog.findUnique({
          where: {
            inverterId_timestamp: {
              inverterId: matchedInverter.id,
              timestamp: timestampUtc,
            },
          },
        });

        if (existing) {
          duplicateCount++;
          continue;
        }

        // Persist telemetry log
        await prisma.solarTelemetryLog.create({
          data: {
            companyId,
            plantId,
            inverterId: matchedInverter.id,
            timestamp: timestampUtc,
            currentPowerKw: normalized.currentPowerKw !== null ? normalized.currentPowerKw : 0,
            dailyEnergyKwh: normalized.dailyEnergyKwh !== null ? normalized.dailyEnergyKwh : 0,
            totalEnergyKwh: normalized.totalEnergyKwh !== null ? normalized.totalEnergyKwh : 0,
            gridVoltageV: normalized.gridVoltageV,
            gridCurrentA: normalized.gridCurrentA,
            frequencyHz: normalized.frequencyHz,
            powerFactor: normalized.powerFactor,
            dcPowerKw: normalized.dcPowerKw,
            dcVoltageV: normalized.dcVoltageV,
            dcCurrentA: normalized.dcCurrentA,
            temperatureC: normalized.temperatureC,
            irradianceWm2: normalized.irradianceWm2,
            ambientTempC: normalized.ambientTempC,
            inverterStatus: normalized.inverterStatus || 'NORMAL',
            rawPayloadJson: normalized.rawPayload || null,
            isSimulated: isSimulated || normalized.isSimulated || false,
          },
        });

        // Update Inverter status & lastTelemetryAt ONLY IF timestamp is newer (prevents out-of-order overwrite)
        if (!matchedInverter.lastTelemetryAt || timestampUtc >= new Date(matchedInverter.lastTelemetryAt)) {
          await prisma.solarInverter.update({
            where: { id: matchedInverter.id },
            data: {
              status: normalized.inverterStatus || 'ONLINE',
              lastTelemetryAt: timestampUtc,
            },
          });
          // Update in-memory reference
          matchedInverter.lastTelemetryAt = timestampUtc;
        }

        ingestedCount++;
      } catch (itemErr) {
        errors.push({ error: itemErr.message });
      }
    }

    // Update plant API config sync count
    try {
      await prisma.solarPlantApiConfig.updateMany({
        where: { plantId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'SUCCESS',
          totalReadingsCount: { increment: ingestedCount },
        },
      });
    } catch (e) {
      // Non-blocking if config not yet initialized
    }

    return {
      ingested: ingestedCount,
      duplicates: duplicateCount,
      errors,
    };
  },

  /**
   * Ingest webhook push directly
   */
  async handleWebhookPush(plantId, webhookToken, headers, body) {
    const config = await prisma.solarPlantApiConfig.findUnique({
      where: { plantId },
      include: { plant: true },
    });

    if (!config || !config.isWebhookEnabled) {
      const error = new Error('Webhook ingestion is disabled or plant not configured.');
      error.statusCode = 403;
      throw error;
    }

    if (config.webhookToken !== webhookToken) {
      const error = new Error('Invalid or expired webhook token.');
      error.statusCode = 401;
      throw error;
    }

    const adapter = solarAdapterRegistry.getAdapter(config.provider);
    const parsed = adapter.parseWebhook(headers, body, config.webhookSecret);

    return this.ingestTelemetryBatch(config.companyId, plantId, parsed.readings, {
      isSimulated: false,
      source: 'WEBHOOK',
      provider: config.provider,
    });
  },

  /**
   * Get latest telemetry snapshot for a plant across all inverters
   */
  async getLatestPlantSnapshot(companyId, plantId) {
    const plant = await prisma.solarPlant.findFirst({
      where: { id: plantId, companyId },
      include: {
        inverters: {
          orderBy: { inverterCode: 'asc' },
        },
      },
    });

    if (!plant) {
      const error = new Error('Solar plant not found.');
      error.statusCode = 404;
      throw error;
    }

    const inverterSnapshots = await Promise.all(
      plant.inverters.map(async (inv) => {
        const latest = await prisma.solarTelemetryLog.findFirst({
          where: { inverterId: inv.id },
          orderBy: { timestamp: 'desc' },
        });

        return {
          inverterId: inv.id,
          inverterCode: inv.inverterCode,
          make: inv.make,
          model: inv.model,
          ratedCapacityKw: Number(inv.ratedCapacityKw),
          status: inv.status,
          lastTelemetryAt: inv.lastTelemetryAt,
          latestReading: latest
            ? {
                timestamp: latest.timestamp,
                currentPowerKw: Number(latest.currentPowerKw),
                dailyEnergyKwh: Number(latest.dailyEnergyKwh),
                totalEnergyKwh: Number(latest.totalEnergyKwh),
                gridVoltageV: latest.gridVoltageV !== null ? Number(latest.gridVoltageV) : null,
                gridCurrentA: latest.gridCurrentA !== null ? Number(latest.gridCurrentA) : null,
                frequencyHz: latest.frequencyHz !== null ? Number(latest.frequencyHz) : null,
                temperatureC: latest.temperatureC !== null ? Number(latest.temperatureC) : null,
                irradianceWm2: latest.irradianceWm2 !== null ? Number(latest.irradianceWm2) : null,
                inverterStatus: latest.inverterStatus,
                isSimulated: latest.isSimulated,
              }
            : null,
        };
      })
    );

    // Plant-level totals
    const totalCurrentPowerKw = inverterSnapshots.reduce(
      (sum, inv) => sum + (inv.latestReading?.currentPowerKw || 0),
      0
    );
    const totalDailyEnergyKwh = inverterSnapshots.reduce(
      (sum, inv) => sum + (inv.latestReading?.dailyEnergyKwh || 0),
      0
    );
    const latestIrradiance = inverterSnapshots.find((inv) => inv.latestReading?.irradianceWm2 !== null)
      ?.latestReading?.irradianceWm2 ?? null;

    return {
      plantId: plant.id,
      plantName: plant.name,
      plantCode: plant.code,
      capacityDcKw: Number(plant.capacityDcKw),
      capacityAcKw: Number(plant.capacityAcKw),
      totalCurrentPowerKw: Math.round(totalCurrentPowerKw * 100) / 100,
      totalDailyEnergyKwh: Math.round(totalDailyEnergyKwh * 100) / 100,
      irradianceWm2: latestIrradiance,
      invertersCount: plant.inverters.length,
      onlineInvertersCount: plant.inverters.filter((i) => ['ONLINE', 'NORMAL'].includes(String(i.status).toUpperCase())).length,
      inverterSnapshots,
    };
  },

  /**
   * Query historical telemetry logs with filtering and pagination
   */
  async getTelemetryHistory(companyId, plantId, query = {}) {
    const { inverterId, startDate, endDate, isSimulated, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = { companyId, plantId };
    if (inverterId) where.inverterId = inverterId;
    if (isSimulated !== undefined) where.isSimulated = isSimulated === 'true' || isSimulated === true;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.solarTelemetryLog.findMany({
        where,
        skip,
        take,
        include: {
          inverter: { select: { inverterCode: true, make: true, model: true } },
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.solarTelemetryLog.count({ where }),
    ]);

    return {
      logs: logs.map((l) => ({
        id: l.id,
        inverterCode: l.inverter.inverterCode,
        timestamp: l.timestamp,
        currentPowerKw: Number(l.currentPowerKw),
        dailyEnergyKwh: Number(l.dailyEnergyKwh),
        totalEnergyKwh: Number(l.totalEnergyKwh),
        gridVoltageV: l.gridVoltageV !== null ? Number(l.gridVoltageV) : null,
        gridCurrentA: l.gridCurrentA !== null ? Number(l.gridCurrentA) : null,
        frequencyHz: l.frequencyHz !== null ? Number(l.frequencyHz) : null,
        temperatureC: l.temperatureC !== null ? Number(l.temperatureC) : null,
        irradianceWm2: l.irradianceWm2 !== null ? Number(l.irradianceWm2) : null,
        inverterStatus: l.inverterStatus,
        isSimulated: l.isSimulated,
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  },
};

export default solarTelemetryService;
