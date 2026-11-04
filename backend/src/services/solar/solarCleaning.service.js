import prisma from '../../config/prisma.js';
import auditService from '../audit.service.js';

export const solarCleaningService = {
  /**
   * Helper: Calculate next due date based on cleaning frequency
   */
  calculateNextDueDate(fromDate, frequency) {
    const base = fromDate ? new Date(fromDate) : new Date();
    const next = new Date(base);

    switch (String(frequency).toUpperCase()) {
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'FORTNIGHTLY':
        next.setDate(next.getDate() + 14);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'ON_DEMAND':
      default:
        next.setDate(next.getDate() + 30);
        break;
    }
    return next;
  },

  /**
   * List cleaning schedules for a company
   */
  async listCleaningSchedules(companyId, query = {}) {
    const { plantId, status, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = { companyId };
    if (plantId) where.plantId = plantId;
    if (status) where.status = String(status).toUpperCase();

    // Check overdue on the fly
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [schedules, total] = await Promise.all([
      prisma.solarCleaningSchedule.findMany({
        where,
        skip,
        take,
        include: {
          plant: { select: { id: true, name: true, code: true } },
          inspector: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { nextDueDate: 'asc' },
      }),
      prisma.solarCleaningSchedule.count({ where }),
    ]);

    // Annotate overdue schedules
    const formatted = schedules.map((s) => ({
      ...s,
      isOverdue: s.status === 'SCHEDULED' && new Date(s.nextDueDate) < today,
      waterUsedLiters: s.waterUsedLiters !== null ? Number(s.waterUsedLiters) : null,
      soilingLossEstimatedPercent: s.soilingLossEstimatedPercent !== null ? Number(s.soilingLossEstimatedPercent) : null,
    }));

    return {
      schedules: formatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  },

  /**
   * Create a new cleaning schedule
   */
  async createCleaningSchedule(companyId, data, actor = null) {
    const { plantId, arrayBlock, frequency = 'MONTHLY', nextDueDate, inspectorId } = data;

    if (!plantId || !arrayBlock) {
      const error = new Error('plantId and arrayBlock are required.');
      error.statusCode = 400;
      throw error;
    }

    // Verify plant belongs to company
    const plant = await prisma.solarPlant.findFirst({
      where: { id: plantId, companyId },
    });
    if (!plant) {
      const error = new Error('Plant not found or does not belong to your company.');
      error.statusCode = 404;
      throw error;
    }

    // Verify inspector employee belongs to company
    let inspectorName = null;
    if (inspectorId) {
      const emp = await prisma.companyEmployee.findFirst({
        where: { id: inspectorId, companyId },
      });
      if (!emp) {
        const error = new Error('Assigned inspector employee does not belong to your company.');
        error.statusCode = 400;
        throw error;
      }
      inspectorName = emp.name;
    }

    const calculatedDueDate = nextDueDate ? new Date(nextDueDate) : this.calculateNextDueDate(new Date(), frequency);

    const schedule = await prisma.solarCleaningSchedule.create({
      data: {
        companyId,
        plantId,
        arrayBlock: String(arrayBlock).trim(),
        frequency: String(frequency).toUpperCase(),
        nextDueDate: calculatedDueDate,
        status: 'SCHEDULED',
        inspectorId: inspectorId || null,
        inspectorName,
      },
      include: {
        plant: { select: { name: true, code: true } },
        inspector: { select: { name: true, email: true } },
      },
    });

    if (actor && auditService?.logAction) {
      await auditService.logAction({
        companyId,
        actorId: actor.id || actor.userId,
        actorType: actor.role || 'USER',
        action: 'SOLAR_CLEANING_SCHEDULE_CREATED',
        entityType: 'SolarCleaningSchedule',
        entityId: schedule.id,
        description: `Created cleaning schedule for ${schedule.arrayBlock} at plant ${plant.code}`,
      });
    }

    return schedule;
  },

  /**
   * Complete a cleaning cycle
   */
  async completeCleaningCycle(companyId, scheduleId, completionData = {}, actor = null) {
    const schedule = await prisma.solarCleaningSchedule.findFirst({
      where: { id: scheduleId, companyId },
      include: { plant: true },
    });

    if (!schedule) {
      const error = new Error('Cleaning schedule not found.');
      error.statusCode = 404;
      throw error;
    }

    const completedAt = new Date();
    const nextDue = this.calculateNextDueDate(completedAt, schedule.frequency);

    const updated = await prisma.solarCleaningSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'COMPLETED',
        completedAt,
        lastCleanedDate: completedAt,
        nextDueDate: nextDue,
        waterUsedLiters: completionData.waterUsedLiters !== undefined ? Number(completionData.waterUsedLiters) : null,
        soilingLossEstimatedPercent: completionData.soilingLossEstimatedPercent !== undefined ? Number(completionData.soilingLossEstimatedPercent) : null,
        cleaningMethod: completionData.cleaningMethod || 'MANUAL_WASH',
        inspectionRemarks: completionData.inspectionRemarks || 'Completed washing cycle.',
      },
    });

    if (actor && auditService?.logAction) {
      await auditService.logAction({
        companyId,
        actorId: actor.id || actor.userId,
        actorType: actor.role || 'USER',
        action: 'SOLAR_CLEANING_COMPLETED',
        entityType: 'SolarCleaningSchedule',
        entityId: scheduleId,
        description: `Completed cleaning cycle for ${schedule.arrayBlock}. Next due: ${nextDue.toISOString().slice(0, 10)}`,
      });
    }

    return updated;
  },
};

export default solarCleaningService;

