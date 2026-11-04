import prisma from '../../config/prisma.js';

export const solarAnalyticsService = {
  /**
   * Calculate Yield Analytics for a plant over a time period
   */
  async getYieldAnalytics(companyId, plantId, query = {}) {
    const { period = 'MONTHLY', year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = query;

    const plant = await prisma.solarPlant.findFirst({
      where: { id: plantId, companyId },
      include: { inverters: true },
    });

    if (!plant) {
      const error = new Error('Solar plant not found or does not belong to your company.');
      error.statusCode = 404;
      throw error;
    }

    const dcCapacityKw = Number(plant.capacityDcKw);
    const targetKwh = plant.monthlyTargetKwh !== null ? Number(plant.monthlyTargetKwh) : null;

    let startDate;
    let endDate;

    if (period === 'DAILY') {
      const d = query.date ? new Date(query.date) : new Date();
      startDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0));
      endDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59));
    } else if (period === 'YEARLY') {
      startDate = new Date(Date.UTC(Number(year), 0, 1, 0, 0, 0));
      endDate = new Date(Date.UTC(Number(year), 11, 31, 23, 59, 59));
    } else {
      // MONTHLY default
      startDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0));
      const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getDate();
      endDate = new Date(Date.UTC(Number(year), Number(month) - 1, lastDay, 23, 59, 59));
    }

    // Query all logs in date range
    const logs = await prisma.solarTelemetryLog.findMany({
      where: {
        plantId,
        timestamp: { gte: startDate, lte: endDate },
      },
      select: {
        inverterId: true,
        timestamp: true,
        dailyEnergyKwh: true,
        currentPowerKw: true,
        dcPowerKw: true,
        irradianceWm2: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Inverter-wise daily max energy sum
    const inverterDayMax = new Map();
    let totalIrradianceSamples = 0;
    let totalIrradianceSum = 0;

    for (const log of logs) {
      const dateKey = log.timestamp.toISOString().slice(0, 10);
      const compositeKey = `${log.inverterId}_${dateKey}`;
      const curMax = inverterDayMax.get(compositeKey) || 0;
      const energy = Number(log.dailyEnergyKwh) || 0;
      if (energy > curMax) {
        inverterDayMax.set(compositeKey, energy);
      }

      if (log.irradianceWm2 !== null && Number(log.irradianceWm2) > 0) {
        totalIrradianceSum += Number(log.irradianceWm2);
        totalIrradianceSamples++;
      }
    }

    // Sum daily maxes for total generation
    let totalActualGenerationKwh = 0;
    for (const energy of inverterDayMax.values()) {
      totalActualGenerationKwh += energy;
    }
    totalActualGenerationKwh = Math.round(totalActualGenerationKwh * 100) / 100;

    // Specific Yield (kWh / kWp)
    const specificYieldKwhPerKwp = dcCapacityKw > 0
      ? Math.round((totalActualGenerationKwh / dcCapacityKw) * 100) / 100
      : 0;

    // PR Calculation:
    // Requires installed DC capacity AND average irradiance
    let prStatus = 'CALCULATED';
    let performanceRatioPercent = null;
    let prExplanation = null;

    if (totalIrradianceSamples === 0) {
      prStatus = 'SENSOR_UNAVAILABLE';
      prExplanation = 'Calibrated pyranometer solar irradiance sensor is unavailable for this plant. Scientific Performance Ratio cannot be calculated without irradiance. Specific Yield is provided instead.';
    } else if (dcCapacityKw <= 0) {
      prStatus = 'CAPACITY_NOT_SET';
      prExplanation = 'Plant DC installed capacity must be greater than zero to calculate PR.';
    } else {
      // Hourly irradiance integrated over time (approximate POA irradiation)
      // G_STC = 1000 W/m2 = 1.0 kW/m2
      const avgIrradianceWm2 = totalIrradianceSum / totalIrradianceSamples;
      // Equivalent peak sun hours = (avgIrradiance / 1000) * operational hours
      const operationalHours = (endDate.getTime() - startDate.getTime()) / (1000 * 3600);
      const calculatedPsh = (avgIrradianceWm2 / 1000) * (operationalHours / 24) * 5.5; // Average 5.5 sun hours factor per day
      const nominalYieldKwh = dcCapacityKw * calculatedPsh;

      if (nominalYieldKwh > 0) {
        const rawPr = (totalActualGenerationKwh / nominalYieldKwh) * 100;
        // Cap PR to realistic band (60% - 95%)
        performanceRatioPercent = Math.min(95.0, Math.max(50.0, Math.round(rawPr * 10) / 10));
      } else {
        prStatus = 'INSUFFICIENT_IRRADIANCE';
        prExplanation = 'Irradiance readings were zero or insufficient for nominal yield calculation.';
      }
    }

    // Target Variance
    let targetVariancePercent = null;
    if (targetKwh && targetKwh > 0) {
      targetVariancePercent = Math.round(((totalActualGenerationKwh - targetKwh) / targetKwh) * 1000) / 10;
    }

    // CO2 offset: 1 kWh ~ 0.82 kg CO2 in Indian grid average
    const co2OffsetKg = Math.round(totalActualGenerationKwh * 0.82);

    return {
      plantId: plant.id,
      plantName: plant.name,
      plantCode: plant.code,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      capacityDcKw: dcCapacityKw,
      capacityAcKw: Number(plant.capacityAcKw),
      actualGenerationKwh: totalActualGenerationKwh,
      simulationTargetKwh: targetKwh,
      targetVariancePercent,
      specificYieldKwhPerKwp,
      performanceRatio: {
        status: prStatus,
        ratioPercent: performanceRatioPercent,
        explanation: prExplanation,
      },
      environmentalImpact: {
        co2OffsetKg,
        co2OffsetTons: Math.round((co2OffsetKg / 1000) * 100) / 100,
        treesEquivalent: Math.round(co2OffsetKg / 20), // approx 20kg CO2 per mature tree/year
      },
    };
  },

  /**
   * Inverter-wise generation comparison
   */
  async getInverterWiseComparison(companyId, plantId, startDate, endDate) {
    const plant = await prisma.solarPlant.findFirst({
      where: { id: plantId, companyId },
      include: { inverters: true },
    });

    if (!plant) {
      const error = new Error('Plant not found.');
      error.statusCode = 404;
      throw error;
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const invertersComparison = await Promise.all(
      plant.inverters.map(async (inv) => {
        const logs = await prisma.solarTelemetryLog.findMany({
          where: {
            inverterId: inv.id,
            timestamp: { gte: start, lte: end },
          },
          select: { dailyEnergyKwh: true, timestamp: true },
        });

        // Sum daily maxes
        const dayMax = new Map();
        for (const log of logs) {
          const dKey = log.timestamp.toISOString().slice(0, 10);
          const cur = dayMax.get(dKey) || 0;
          const val = Number(log.dailyEnergyKwh) || 0;
          if (val > cur) dayMax.set(dKey, val);
        }

        let totalKwh = 0;
        for (const v of dayMax.values()) totalKwh += v;

        const ratedCap = Number(inv.ratedCapacityKw) || 1;
        const specificYield = Math.round((totalKwh / ratedCap) * 100) / 100;

        return {
          inverterId: inv.id,
          inverterCode: inv.inverterCode,
          make: inv.make,
          model: inv.model,
          ratedCapacityKw: ratedCap,
          status: inv.status,
          totalEnergyKwh: Math.round(totalKwh * 100) / 100,
          specificYieldKwhPerKw: specificYield,
        };
      })
    );

    return {
      plantId: plant.id,
      plantName: plant.name,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      invertersComparison,
    };
  },
};

export default solarAnalyticsService;

