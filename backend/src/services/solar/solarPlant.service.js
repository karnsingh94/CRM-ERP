import prisma from '../../config/prisma.js';
import auditService from '../audit.service.js';

export const solarPlantService = {
  // =========================================================================
  // 1. SOLAR PLANTS MASTER
  // =========================================================================
  async listPlants(companyId, query = {}) {
    const { search, status, plantType, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = { companyId };
    if (status) where.status = String(status).toUpperCase();
    if (plantType) where.plantType = String(plantType);
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { code: { contains: String(search) } },
        { city: { contains: String(search) } },
      ];
    }

    const [plants, total] = await Promise.all([
      prisma.solarPlant.findMany({
        where,
        skip,
        take,
        include: {
          _count: {
            select: {
              inverters: true,
              panelStrings: true,
              alarms: { where: { status: 'ACTIVE' } },
            },
          },
          apiConfig: {
            select: {
              id: true,
              provider: true,
              status: true,
              lastSyncAt: true,
              lastSyncStatus: true,
              isPollingEnabled: true,
              isWebhookEnabled: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.solarPlant.count({ where }),
    ]);

    return {
      plants,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  },

  async getPlantById(companyId, plantId) {
    const plant = await prisma.solarPlant.findFirst({
      where: { id: plantId, companyId },
      include: {
        inverters: {
          orderBy: { inverterCode: 'asc' },
        },
        panelStrings: {
          orderBy: { stringId: 'asc' },
        },
        apiConfig: {
          select: {
            id: true,
            provider: true,
            baseUrl: true,
            authType: true,
            pollingIntervalMinutes: true,
            isPollingEnabled: true,
            isWebhookEnabled: true,
            webhookToken: true,
            status: true,
            lastSyncStatus: true,
            lastSyncError: true,
            lastSyncAt: true,
            totalReadingsCount: true,
          },
        },
        _count: {
          select: {
            alarms: { where: { status: 'ACTIVE' } },
            maintenanceTickets: { where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } },
          },
        },
      },
    });

    if (!plant) {
      const error = new Error('Solar plant not found or does not belong to your company.');
      error.statusCode = 404;
      throw error;
    }

    return plant;
  },

  async createPlant(companyId, data, actor = null) {
    if (!data.name || !data.code || data.capacityDcKw === undefined || data.capacityAcKw === undefined) {
      const error = new Error('Plant name, code, capacityDcKw, and capacityAcKw are required.');
      error.statusCode = 400;
      throw error;
    }

    // Check code uniqueness within company
    const existing = await prisma.solarPlant.findUnique({
      where: { companyId_code: { companyId, code: String(data.code).trim().toUpperCase() } },
    });
    if (existing) {
      const error = new Error(`Plant with code "${data.code}" already exists in your company.`);
      error.statusCode = 409;
      throw error;
    }

    const plant = await prisma.solarPlant.create({
      data: {
        companyId,
        name: String(data.name).trim(),
        code: String(data.code).trim().toUpperCase(),
        plantType: data.plantType || 'ROOFTOP_INDUSTRIAL',
        capacityDcKw: Number(data.capacityDcKw),
        capacityAcKw: Number(data.capacityAcKw),
        commissionDate: data.commissionDate ? new Date(data.commissionDate) : null,
        status: data.status ? String(data.status).toUpperCase() : 'ACTIVE',
        timezone: data.timezone || 'Asia/Kolkata',
        locationAddress: data.locationAddress || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        latitude: data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null,
        longitude: data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null,
        gridVoltage: data.gridVoltage || null,
        monthlyTargetKwh: data.monthlyTargetKwh !== undefined && data.monthlyTargetKwh !== null ? Number(data.monthlyTargetKwh) : null,
        notes: data.notes || null,
      },
    });

    if (actor && auditService?.logAction) {
      await auditService.logAction({
        companyId,
        actorId: actor.id || actor.userId,
        actorType: actor.role || 'USER',
        action: 'SOLAR_PLANT_CREATED',
        entityType: 'SolarPlant',
        entityId: plant.id,
        description: `Created solar plant ${plant.name} (${plant.code})`,
        metadata: { code: plant.code, capacityDcKw: plant.capacityDcKw },
      });
    }

    return plant;
  },

  async updatePlant(companyId, plantId, data, actor = null) {
    await this.getPlantById(companyId, plantId);

    const updateData = {};
    if (data.name) updateData.name = String(data.name).trim();
    if (data.plantType) updateData.plantType = String(data.plantType);
    if (data.capacityDcKw !== undefined) updateData.capacityDcKw = Number(data.capacityDcKw);
    if (data.capacityAcKw !== undefined) updateData.capacityAcKw = Number(data.capacityAcKw);
    if (data.commissionDate !== undefined) updateData.commissionDate = data.commissionDate ? new Date(data.commissionDate) : null;
    if (data.status) updateData.status = String(data.status).toUpperCase();
    if (data.timezone) updateData.timezone = String(data.timezone);
    if (data.locationAddress !== undefined) updateData.locationAddress = data.locationAddress;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.pincode !== undefined) updateData.pincode = data.pincode;
    if (data.latitude !== undefined) updateData.latitude = data.latitude ? Number(data.latitude) : null;
    if (data.longitude !== undefined) updateData.longitude = data.longitude ? Number(data.longitude) : null;
    if (data.gridVoltage !== undefined) updateData.gridVoltage = data.gridVoltage;
    if (data.monthlyTargetKwh !== undefined) updateData.monthlyTargetKwh = data.monthlyTargetKwh ? Number(data.monthlyTargetKwh) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.solarPlant.update({
      where: { id: plantId },
      data: updateData,
    });

    if (actor && auditService?.logAction) {
      await auditService.logAction({
        companyId,
        actorId: actor.id || actor.userId,
        actorType: actor.role || 'USER',
        action: 'SOLAR_PLANT_UPDATED',
        entityType: 'SolarPlant',
        entityId: plantId,
        description: `Updated solar plant ${updated.name}`,
        metadata: updateData,
      });
    }

    return updated;
  },

  // =========================================================================
  // 2. INVERTERS CONFIGURATION
  // =========================================================================
  async listInverters(companyId, plantId = null, query = {}) {
    const where = { companyId };
    if (plantId) {
      await this.getPlantById(companyId, plantId);
      where.plantId = plantId;
    }
    if (query.status) where.status = String(query.status).toUpperCase();
    if (query.search) {
      where.OR = [
        { inverterCode: { contains: String(query.search) } },
        { serialNumber: { contains: String(query.search) } },
        { make: { contains: String(query.search) } },
        { model: { contains: String(query.search) } },
      ];
    }

    return prisma.solarInverter.findMany({
      where,
      include: {
        plant: { select: { id: true, name: true, code: true } },
        _count: {
          select: { panelStrings: true, alarms: { where: { status: 'ACTIVE' } } },
        },
      },
      orderBy: { inverterCode: 'asc' },
    });
  },

  async getInverterById(companyId, inverterId) {
    const inverter = await prisma.solarInverter.findFirst({
      where: { id: inverterId, companyId },
      include: {
        plant: { select: { id: true, name: true, code: true, capacityDcKw: true } },
        panelStrings: true,
        alarms: {
          where: { status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } },
          orderBy: { triggeredAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!inverter) {
      const error = new Error('Inverter not found or does not belong to your company.');
      error.statusCode = 404;
      throw error;
    }

    return inverter;
  },

  async createInverter(companyId, plantId, data, actor = null) {
    await this.getPlantById(companyId, plantId);

    if (!data.inverterCode || !data.make || !data.model || !data.serialNumber || data.ratedCapacityKw === undefined) {
      const error = new Error('Inverter code, make, model, serialNumber, and ratedCapacityKw are required.');
      error.statusCode = 400;
      throw error;
    }

    // Check unique serial number under same plant
    const existing = await prisma.solarInverter.findFirst({
      where: {
        companyId,
        plantId,
        OR: [
          { serialNumber: String(data.serialNumber).trim() },
          { inverterCode: String(data.inverterCode).trim().toUpperCase() },
        ],
      },
    });
    if (existing) {
      const error = new Error('An inverter with this code or serial number already exists in this plant.');
      error.statusCode = 409;
      throw error;
    }

    const inverter = await prisma.solarInverter.create({
      data: {
        companyId,
        plantId,
        inverterCode: String(data.inverterCode).trim().toUpperCase(),
        make: String(data.make).trim(),
        model: String(data.model).trim(),
        serialNumber: String(data.serialNumber).trim(),
        ratedCapacityKw: Number(data.ratedCapacityKw),
        maxDcPowerKw: data.maxDcPowerKw !== undefined && data.maxDcPowerKw !== null ? Number(data.maxDcPowerKw) : null,
        mpptChannels: Number(data.mpptChannels) || 1,
        stringsPerMppt: data.stringsPerMppt !== undefined && data.stringsPerMppt !== null ? Number(data.stringsPerMppt) : null,
        ipAddress: data.ipAddress || null,
        modbusAddress: data.modbusAddress ? Number(data.modbusAddress) : null,
        gatewayId: data.gatewayId || null,
        status: data.status ? String(data.status).toUpperCase() : 'OFFLINE',
        efficiencyPercent: data.efficiencyPercent !== undefined && data.efficiencyPercent !== null ? Number(data.efficiencyPercent) : null,
        notes: data.notes || null,
      },
    });

    return inverter;
  },

  async updateInverter(companyId, inverterId, data, actor = null) {
    await this.getInverterById(companyId, inverterId);

    const updateData = {};
    if (data.make) updateData.make = String(data.make).trim();
    if (data.model) updateData.model = String(data.model).trim();
    if (data.ratedCapacityKw !== undefined) updateData.ratedCapacityKw = Number(data.ratedCapacityKw);
    if (data.maxDcPowerKw !== undefined) updateData.maxDcPowerKw = data.maxDcPowerKw ? Number(data.maxDcPowerKw) : null;
    if (data.mpptChannels !== undefined) updateData.mpptChannels = Number(data.mpptChannels);
    if (data.stringsPerMppt !== undefined) updateData.stringsPerMppt = data.stringsPerMppt ? Number(data.stringsPerMppt) : null;
    if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress;
    if (data.modbusAddress !== undefined) updateData.modbusAddress = data.modbusAddress ? Number(data.modbusAddress) : null;
    if (data.gatewayId !== undefined) updateData.gatewayId = data.gatewayId;
    if (data.status) updateData.status = String(data.status).toUpperCase();
    if (data.efficiencyPercent !== undefined) updateData.efficiencyPercent = data.efficiencyPercent ? Number(data.efficiencyPercent) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return prisma.solarInverter.update({
      where: { id: inverterId },
      data: updateData,
    });
  },

  // =========================================================================
  // 3. PANEL STRINGS & LAYOUT
  // =========================================================================
  async listPanelStrings(companyId, plantId, inverterId = null) {
    await this.getPlantById(companyId, plantId);
    const where = { companyId, plantId };
    if (inverterId) where.inverterId = inverterId;

    return prisma.solarPanelString.findMany({
      where,
      include: {
        inverter: { select: { id: true, inverterCode: true, make: true, model: true } },
      },
      orderBy: { stringId: 'asc' },
    });
  },

  async createPanelString(companyId, plantId, data, actor = null) {
    await this.getPlantById(companyId, plantId);

    const stringId = data.stringId || data.stringName;
    const modulesCount = data.modulesCount !== undefined ? data.modulesCount : data.panelsCount;
    const moduleWattageW = data.moduleWattageW !== undefined ? data.moduleWattageW : data.panelWattageWp;

    if (!stringId || !modulesCount || !moduleWattageW) {
      const error = new Error('stringId, modulesCount, and moduleWattageW are required.');
      error.statusCode = 400;
      throw error;
    }

    if (data.inverterId) {
      const inv = await prisma.solarInverter.findFirst({
        where: { id: data.inverterId, plantId, companyId },
      });
      if (!inv) {
        const error = new Error('Specified inverter does not belong to this plant.');
        error.statusCode = 400;
        throw error;
      }
    }

    const totalWattageWp = Number(modulesCount) * Number(moduleWattageW);

    const stringItem = await prisma.solarPanelString.create({
      data: {
        companyId,
        plantId,
        inverterId: data.inverterId || null,
        stringId: String(stringId).trim().toUpperCase(),
        modulesCount: Number(modulesCount),
        moduleModel: data.moduleModel || data.panelModel || null,
        moduleWattageW: Number(moduleWattageW),
        totalWattageWp,
        tiltDegrees: data.tiltDegrees !== undefined && data.tiltDegrees !== null ? Number(data.tiltDegrees) : null,
        azimuthDegrees: data.azimuthDegrees !== undefined && data.azimuthDegrees !== null ? Number(data.azimuthDegrees) : null,
        orientation: data.orientation || null,
        mpptIndex: data.mpptIndex !== undefined && data.mpptIndex !== null ? Number(data.mpptIndex) : null,
        vmpRated: data.vmpRated !== undefined && data.vmpRated !== null ? Number(data.vmpRated) : null,
        impRated: data.impRated !== undefined && data.impRated !== null ? Number(data.impRated) : null,
        status: data.status ? String(data.status).toUpperCase() : 'ACTIVE',
        notes: data.notes || null,
      },
    });

    return {
      ...stringItem,
      stringName: stringItem.stringId,
      panelsCount: stringItem.modulesCount,
      panelWattageWp: stringItem.moduleWattageW,
      panelModel: stringItem.moduleModel,
    };
  },

  async updatePanelString(companyId, stringId, data) {
    const existing = await prisma.solarPanelString.findFirst({
      where: { id: stringId, companyId },
    });
    if (!existing) {
      const error = new Error('Panel string not found or does not belong to your company.');
      error.statusCode = 404;
      throw error;
    }

    const updateData = {};
    if (data.inverterId !== undefined) updateData.inverterId = data.inverterId;
    if (data.modulesCount !== undefined || data.panelsCount !== undefined) {
      updateData.modulesCount = Number(data.modulesCount !== undefined ? data.modulesCount : data.panelsCount);
    }
    if (data.moduleModel !== undefined || data.panelModel !== undefined) {
      updateData.moduleModel = data.moduleModel !== undefined ? data.moduleModel : data.panelModel;
    }
    if (data.moduleWattageW !== undefined || data.panelWattageWp !== undefined) {
      updateData.moduleWattageW = Number(data.moduleWattageW !== undefined ? data.moduleWattageW : data.panelWattageWp);
    }

    const mCount = updateData.modulesCount !== undefined ? updateData.modulesCount : existing.modulesCount;
    const mWatt = updateData.moduleWattageW !== undefined ? updateData.moduleWattageW : existing.moduleWattageW;
    updateData.totalWattageWp = mCount * mWatt;

    if (data.tiltDegrees !== undefined) updateData.tiltDegrees = data.tiltDegrees ? Number(data.tiltDegrees) : null;
    if (data.azimuthDegrees !== undefined) updateData.azimuthDegrees = data.azimuthDegrees ? Number(data.azimuthDegrees) : null;
    if (data.orientation !== undefined) updateData.orientation = data.orientation;
    if (data.mpptIndex !== undefined) updateData.mpptIndex = data.mpptIndex ? Number(data.mpptIndex) : null;
    if (data.vmpRated !== undefined) updateData.vmpRated = data.vmpRated ? Number(data.vmpRated) : null;
    if (data.impRated !== undefined) updateData.impRated = data.impRated ? Number(data.impRated) : null;
    if (data.status) updateData.status = String(data.status).toUpperCase();

    const updated = await prisma.solarPanelString.update({
      where: { id: stringId },
      data: updateData,
    });

    return {
      ...updated,
      stringName: updated.stringId,
      panelsCount: updated.modulesCount,
      panelWattageWp: updated.moduleWattageW,
      panelModel: updated.moduleModel,
    };
  },
};

export default solarPlantService;

