import prisma from '../../config/prisma.js';
import { notificationService } from '../notification.service.js';
import auditService from '../audit.service.js';

export const solarAlarmService = {
  /**
   * List alarms with filtering and pagination
   */
  async listAlarms(companyId, query = {}) {
    const { plantId, inverterId, severity, status, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = { companyId };
    if (plantId) where.plantId = plantId;
    if (inverterId) where.inverterId = inverterId;
    if (severity) where.severity = String(severity).toUpperCase();
    if (status) where.status = String(status).toUpperCase();

    const [alarms, total] = await Promise.all([
      prisma.solarInverterAlarm.findMany({
        where,
        skip,
        take,
        include: {
          plant: { select: { id: true, name: true, code: true } },
          inverter: { select: { id: true, inverterCode: true, make: true, model: true } },
          maintenanceTicket: { select: { id: true, ticketNo: true, status: true, priority: true } },
        },
        orderBy: { triggeredAt: 'desc' },
      }),
      prisma.solarInverterAlarm.count({ where }),
    ]);

    return {
      alarms,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  },

  /**
   * Ingest or raise an alarm (with strict deduplication of active alarms)
   */
  async raiseAlarm(companyId, data, actor = null) {
    const { plantId, inverterId, alarmCode, severity = 'WARNING', description, category } = data;

    if (!plantId || !inverterId || !alarmCode || !description) {
      const error = new Error('plantId, inverterId, alarmCode, and description are required.');
      error.statusCode = 400;
      throw error;
    }

    // Verify plant and inverter belong to company
    const inverter = await prisma.solarInverter.findFirst({
      where: { id: inverterId, plantId, companyId },
      include: { plant: true },
    });

    if (!inverter) {
      const error = new Error('Inverter not found or does not belong to specified plant/company.');
      error.statusCode = 404;
      throw error;
    }

    // Duplicate Check: If an alarm with same alarmCode on this inverter is already ACTIVE or ACKNOWLEDGED, do not duplicate
    const existing = await prisma.solarInverterAlarm.findFirst({
      where: {
        inverterId,
        alarmCode: String(alarmCode).trim(),
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
      },
    });

    if (existing) {
      return {
        alarm: existing,
        isDuplicate: true,
        message: 'Active alarm already exists for this inverter and fault code.',
      };
    }

    const alarm = await prisma.solarInverterAlarm.create({
      data: {
        companyId,
        plantId,
        inverterId,
        alarmCode: String(alarmCode).trim(),
        severity: String(severity).toUpperCase(),
        category: category ? String(category).toUpperCase() : 'GENERAL',
        description: String(description).trim(),
        status: 'ACTIVE',
      },
      include: {
        plant: { select: { name: true, code: true } },
        inverter: { select: { inverterCode: true } },
      },
    });

    // If alarm is CRITICAL, broadcast in-app notification to company managers
    if (alarm.severity === 'CRITICAL' && notificationService?.createNotification) {
      try {
        await notificationService.createNotification({
          companyId,
          recipientId: 'MANAGERS',
          title: `CRITICAL Solar Alarm: ${alarm.inverter.inverterCode}`,
          message: `${alarm.plant.name} - ${alarm.description} (${alarm.alarmCode})`,
          category: 'ALERT',
          entityType: 'SolarInverterAlarm',
          entityId: alarm.id,
        });
      } catch (notifErr) {
        // Non-blocking
      }
    }

    if (actor && auditService?.logAction) {
      await auditService.logAction({
        companyId,
        actorId: actor.id || actor.userId,
        actorType: actor.role || 'SYSTEM',
        action: 'SOLAR_ALARM_RAISED',
        entityType: 'SolarInverterAlarm',
        entityId: alarm.id,
        description: `Alarm ${alarm.alarmCode} raised on inverter ${inverter.inverterCode}`,
      });
    }

    return {
      alarm,
      isDuplicate: false,
    };
  },

  /**
   * Acknowledge an alarm
   */
  async acknowledgeAlarm(companyId, alarmId, notes = '', actor) {
    const alarm = await prisma.solarInverterAlarm.findFirst({
      where: { id: alarmId, companyId },
    });

    if (!alarm) {
      const error = new Error('Alarm not found.');
      error.statusCode = 404;
      throw error;
    }

    if (alarm.status === 'RESOLVED') {
      const error = new Error('Cannot acknowledge an already resolved alarm.');
      error.statusCode = 400;
      throw error;
    }

    return prisma.solarInverterAlarm.update({
      where: { id: alarmId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: actor?.name || actor?.email || 'System User',
        acknowledgementNotes: notes || null,
      },
    });
  },

  /**
   * Resolve an alarm
   */
  async resolveAlarm(companyId, alarmId, resolutionNotes = '', actor) {
    const alarm = await prisma.solarInverterAlarm.findFirst({
      where: { id: alarmId, companyId },
    });

    if (!alarm) {
      const error = new Error('Alarm not found.');
      error.statusCode = 404;
      throw error;
    }

    return prisma.solarInverterAlarm.update({
      where: { id: alarmId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: actor?.name || actor?.email || 'System User',
        resolutionNotes: resolutionNotes || 'Resolved by operator',
      },
    });
  },
};

export default solarAlarmService;
