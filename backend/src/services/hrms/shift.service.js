import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';

function shiftError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const shiftService = {
  // =========================================================================
  // 1. SHIFT POLICY CRUD
  // =========================================================================

  async createShiftPolicy(companyId, data, actor = {}) {
    const {
      shiftName,
      shiftCode,
      startTime,
      endTime,
      isOvernight = false,
      graceMinutes = 15,
      breakDurationMinutes = 60,
      halfDayThresholdHours = 4.0,
      fullDayThresholdHours = 8.0,
      isDefault = false,
      status = 'ACTIVE',
    } = data;

    if (!shiftName || !shiftCode || !startTime || !endTime) {
      throw shiftError('shiftName, shiftCode, startTime, and endTime are required.');
    }

    const code = shiftCode.trim().toUpperCase();
    const existing = await prisma.shiftPolicy.findUnique({
      where: { companyId_shiftCode: { companyId, shiftCode: code } },
    });
    if (existing) {
      throw shiftError(`Shift policy with code "${code}" already exists for this company.`, 409);
    }

    // Auto-detect overnight if start time > end time (e.g. 21:00 to 06:00)
    let overnight = Boolean(isOvernight);
    if (!overnight && startTime > endTime) {
      overnight = true;
    }

    if (isDefault) {
      // Unset previous default
      await prisma.shiftPolicy.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const shift = await prisma.shiftPolicy.create({
      data: {
        companyId,
        shiftName: shiftName.trim(),
        shiftCode: code,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        isOvernight: overnight,
        graceMinutes: Number(graceMinutes) || 0,
        breakDurationMinutes: Number(breakDurationMinutes) || 0,
        halfDayThresholdHours: Number(halfDayThresholdHours) || 4.0,
        fullDayThresholdHours: Number(fullDayThresholdHours) || 8.0,
        isDefault: Boolean(isDefault),
        status,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_SHIFT_POLICY',
      entityType: 'SHIFT_POLICY',
      entityId: shift.id,
      afterState: shift,
      reason: `Created shift policy ${shift.shiftName} (${shift.shiftCode})`,
    });

    return shift;
  },

  async listShiftPolicies(companyId, filters = {}) {
    const { status, isDefault } = filters;
    const where = { companyId };
    if (status) where.status = status;
    if (isDefault !== undefined) where.isDefault = isDefault === 'true' || isDefault === true;

    return prisma.shiftPolicy.findMany({
      where,
      orderBy: { shiftName: 'asc' },
    });
  },

  async getShiftPolicyById(companyId, id) {
    const shift = await prisma.shiftPolicy.findFirst({
      where: { id, companyId },
    });
    if (!shift) throw shiftError('Shift policy not found.', 404);
    return shift;
  },

  async updateShiftPolicy(companyId, id, data, actor = {}) {
    const existing = await this.getShiftPolicyById(companyId, id);

    if (data.isDefault) {
      await prisma.shiftPolicy.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    let overnight = data.isOvernight !== undefined ? Boolean(data.isOvernight) : existing.isOvernight;
    const st = data.startTime || existing.startTime;
    const et = data.endTime || existing.endTime;
    if (st > et) overnight = true;

    const updated = await prisma.shiftPolicy.update({
      where: { id },
      data: {
        shiftName: data.shiftName !== undefined ? data.shiftName.trim() : existing.shiftName,
        startTime: st,
        endTime: et,
        isOvernight: overnight,
        graceMinutes: data.graceMinutes !== undefined ? Number(data.graceMinutes) : existing.graceMinutes,
        breakDurationMinutes: data.breakDurationMinutes !== undefined ? Number(data.breakDurationMinutes) : existing.breakDurationMinutes,
        halfDayThresholdHours: data.halfDayThresholdHours !== undefined ? Number(data.halfDayThresholdHours) : existing.halfDayThresholdHours,
        fullDayThresholdHours: data.fullDayThresholdHours !== undefined ? Number(data.fullDayThresholdHours) : existing.fullDayThresholdHours,
        isDefault: data.isDefault !== undefined ? Boolean(data.isDefault) : existing.isDefault,
        status: data.status !== undefined ? data.status : existing.status,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'UPDATE_SHIFT_POLICY',
      entityType: 'SHIFT_POLICY',
      entityId: id,
      beforeState: existing,
      afterState: updated,
      reason: 'Updated shift policy',
    });

    return updated;
  },

  // =========================================================================
  // 2. SHIFT ROSTER & SCHEDULING
  // =========================================================================

  async assignShiftRoster(companyId, data, actor = {}) {
    const {
      employeeProfileId,
      departmentId,
      shiftId,
      startDate,
      endDate,
      isWeeklyOff = false,
      notes,
    } = data;

    if (!shiftId || !startDate) {
      throw shiftError('shiftId and startDate are required.');
    }

    // Validate shift
    await this.getShiftPolicyById(companyId, shiftId);

    let targetProfiles = [];
    if (employeeProfileId) {
      const p = await prisma.employeeProfile.findFirst({
        where: { id: employeeProfileId, companyId },
      });
      if (!p) throw shiftError('Employee profile not found.', 404);
      targetProfiles.push(p.id);
    } else if (departmentId) {
      const deptProfiles = await prisma.employeeProfile.findMany({
        where: { companyId, departmentId, employmentStatus: 'ACTIVE' },
        select: { id: true },
      });
      targetProfiles = deptProfiles.map((p) => p.id);
      if (targetProfiles.length === 0) {
        throw shiftError('No active employees found in the specified department.', 400);
      }
    } else {
      throw shiftError('Either employeeProfileId or departmentId must be provided.');
    }

    const sDate = new Date(startDate);
    const eDate = endDate ? new Date(endDate) : null;

    const createdRosters = [];
    for (const pid of targetProfiles) {
      const roster = await prisma.employeeShiftRoster.create({
        data: {
          companyId,
          employeeProfileId: pid,
          shiftId,
          startDate: sDate,
          endDate: eDate,
          isWeeklyOff: Boolean(isWeeklyOff),
          notes: notes ? notes.trim() : null,
        },
      });
      createdRosters.push(roster);
    }

    await auditService.logAction({
      companyId,
      actor,
      action: 'ASSIGN_SHIFT_ROSTER',
      entityType: 'EMPLOYEE_SHIFT_ROSTER',
      entityId: createdRosters[0]?.id || 'bulk',
      details: { totalAssigned: createdRosters.length, shiftId, startDate, endDate },
      reason: `Assigned shift roster to ${createdRosters.length} employee(s)`,
    });

    return createdRosters;
  },

  async getEmployeeRoster(companyId, employeeProfileId, startDate, endDate) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw shiftError('Employee profile not found.', 404);

    const where = {
      companyId,
      employeeProfileId,
    };
    if (startDate) {
      where.startDate = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.OR = [
        { endDate: null },
        { endDate: { lte: new Date(endDate) } },
      ];
    }

    return prisma.employeeShiftRoster.findMany({
      where,
      include: { shift: true },
      orderBy: { startDate: 'desc' },
    });
  },
};

export default shiftService;

