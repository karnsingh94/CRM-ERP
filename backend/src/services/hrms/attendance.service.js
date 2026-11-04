import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { approvalService } from '../approval.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function attError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const attendanceService = {
  // =========================================================================
  // 1. CHECK-IN / CHECK-OUT / RECORD ATTENDANCE
  // =========================================================================

  /**
   * Calculate hours, late arrival, early exit based on shift
   */
  calculateAttendanceMetrics(firstIn, lastOut, shift) {
    if (!firstIn) {
      return {
        totalWorkHours: 0,
        breakHours: 0,
        overtimeHours: 0,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        status: 'ABSENT',
      };
    }

    let lateMinutes = 0;
    let earlyExitMinutes = 0;

    if (shift && shift.startTime) {
      const inMinutes = firstIn.getHours() * 60 + firstIn.getMinutes();
      const shiftStartMinutes = parseTimeToMinutes(shift.startTime);
      const grace = shift.graceMinutes || 0;
      if (inMinutes > shiftStartMinutes + grace) {
        lateMinutes = inMinutes - shiftStartMinutes;
      }
    }

    let diffHours = 0;
    if (firstIn && lastOut) {
      const diffMs = lastOut.getTime() - firstIn.getTime();
      if (diffMs > 0) {
        diffHours = diffMs / (1000 * 60 * 60);
      }
    }

    const breakHours = shift ? (shift.breakDurationMinutes || 0) / 60 : 0;
    const netWorkHours = Math.max(0, diffHours - breakHours);

    const fullThreshold = shift ? Number(shift.fullDayThresholdHours || 8.0) : 8.0;
    const halfThreshold = shift ? Number(shift.halfDayThresholdHours || 4.0) : 4.0;

    let status = 'PRESENT';
    if (netWorkHours < halfThreshold) {
      status = 'ABSENT';
    } else if (netWorkHours < fullThreshold) {
      status = 'HALF_DAY';
    }

    let overtimeHours = 0;
    if (netWorkHours > fullThreshold) {
      overtimeHours = netWorkHours - fullThreshold;
    }

    return {
      totalWorkHours: Number(netWorkHours.toFixed(2)),
      breakHours: Number(breakHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      lateMinutes,
      earlyExitMinutes,
      status,
    };
  },

  async recordCheckIn(companyId, employeeProfileId, timestamp = new Date(), source = 'WEB', actor = {}) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw attError('Employee profile not found.', 404);

    const inTime = new Date(timestamp);
    const dateStr = inTime.toISOString().split('T')[0];
    const attendanceDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Resolve shift policy
    let shift = await prisma.shiftPolicy.findFirst({
      where: { companyId, isDefault: true },
    });
    if (!shift) {
      shift = await prisma.shiftPolicy.findFirst({
        where: { companyId, status: 'ACTIVE' },
      });
    }

    // Check existing attendance for the day
    let record = await prisma.dailyAttendance.findUnique({
      where: {
        companyId_employeeProfileId_attendanceDate: {
          companyId,
          employeeProfileId,
          attendanceDate,
        },
      },
    });

    if (record) {
      if (record.firstInTime) {
        throw attError(`Check-in already recorded for today at ${record.firstInTime.toLocaleTimeString()}.`, 409);
      }
      const metrics = this.calculateAttendanceMetrics(inTime, record.lastOutTime, shift);
      record = await prisma.dailyAttendance.update({
        where: { id: record.id },
        data: {
          firstInTime: inTime,
          shiftId: shift?.id,
          totalWorkHours: metrics.totalWorkHours,
          lateMinutes: metrics.lateMinutes,
          status: metrics.status,
          source,
        },
      });
    } else {
      const metrics = this.calculateAttendanceMetrics(inTime, null, shift);
      record = await prisma.dailyAttendance.create({
        data: {
          companyId,
          employeeProfileId,
          attendanceDate,
          shiftId: shift?.id,
          firstInTime: inTime,
          source,
          totalWorkHours: 0,
          lateMinutes: metrics.lateMinutes,
          status: 'PRESENT',
        },
      });
    }

    await auditService.logAction({
      companyId,
      actor,
      action: 'CHECK_IN',
      entityType: 'DAILY_ATTENDANCE',
      entityId: record.id,
      details: { attendanceDate, inTime, source },
      reason: `Recorded check-in for employee ${profile.employeeCode}`,
    });

    return record;
  },

  async recordCheckOut(companyId, employeeProfileId, timestamp = new Date(), source = 'WEB', actor = {}) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw attError('Employee profile not found.', 404);

    const outTime = new Date(timestamp);
    const dateStr = outTime.toISOString().split('T')[0];
    const attendanceDate = new Date(`${dateStr}T00:00:00.000Z`);

    const record = await prisma.dailyAttendance.findUnique({
      where: {
        companyId_employeeProfileId_attendanceDate: {
          companyId,
          employeeProfileId,
          attendanceDate,
        },
      },
      include: { shift: true },
    });

    if (!record) {
      throw attError('No check-in record found for today. Please check-in first or apply for regularization.', 404);
    }

    const shift = record.shift;
    const metrics = this.calculateAttendanceMetrics(record.firstInTime, outTime, shift);

    const updated = await prisma.dailyAttendance.update({
      where: { id: record.id },
      data: {
        lastOutTime: outTime,
        totalWorkHours: metrics.totalWorkHours,
        breakHours: metrics.breakHours,
        overtimeHours: metrics.overtimeHours,
        earlyExitMinutes: metrics.earlyExitMinutes,
        status: metrics.status,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CHECK_OUT',
      entityType: 'DAILY_ATTENDANCE',
      entityId: updated.id,
      details: { attendanceDate, outTime, workHours: metrics.totalWorkHours },
      reason: `Recorded check-out for employee ${profile.employeeCode}`,
    });

    return updated;
  },

  async listAttendance(companyId, filters = {}) {
    const {
      employeeProfileId,
      departmentId,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50,
    } = filters;

    const where = { companyId };
    if (employeeProfileId) where.employeeProfileId = employeeProfileId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.attendanceDate = {};
      if (startDate) where.attendanceDate.gte = new Date(startDate);
      if (endDate) where.attendanceDate.lte = new Date(endDate);
    }

    if (departmentId) {
      where.profile = { departmentId };
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const take = Math.max(1, Number(limit));

    const [total, items] = await Promise.all([
      prisma.dailyAttendance.count({ where }),
      prisma.dailyAttendance.findMany({
        where,
        skip,
        take,
        include: {
          profile: {
            select: { id: true, employeeCode: true, displayName: true, department: true },
          },
          shift: true,
        },
        orderBy: { attendanceDate: 'desc' },
      }),
    ]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
      items,
    };
  },

  // =========================================================================
  // 2. ATTENDANCE REGULARIZATION
  // =========================================================================

  async requestRegularization(companyId, data, actor = {}) {
    const { employeeProfileId, attendanceDate, requestedInTime, requestedOutTime, reason } = data;
    if (!employeeProfileId || !attendanceDate || !reason) {
      throw attError('employeeProfileId, attendanceDate, and reason are required.');
    }

    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw attError('Employee profile not found.', 404);

    const aDate = new Date(attendanceDate);

    // Create regularization record
    const reg = await prisma.attendanceRegularization.create({
      data: {
        companyId,
        employeeProfileId,
        attendanceDate: aDate,
        requestedInTime: requestedInTime ? new Date(requestedInTime) : null,
        requestedOutTime: requestedOutTime ? new Date(requestedOutTime) : null,
        reason: reason.trim(),
        status: 'PENDING',
      },
    });

    // Submit to Approval Engine
    const appReq = await approvalService.createRequest({
      companyId,
      entityType: 'ATTENDANCE_REGULARIZATION',
      entityId: reg.id,
      title: `Attendance Regularization: ${profile.displayName} for ${aDate.toDateString()}`,
      summary: reason.trim(),
      creatorId: actor.userId || actor.id,
      creatorName: actor.name || profile.displayName,
      role: actor.role || 'EMPLOYEE',
    });

    await prisma.attendanceRegularization.update({
      where: { id: reg.id },
      data: { approvalRequestId: appReq.id },
    });

    return { ...reg, approvalRequestId: appReq.id };
  },

  async approveRegularization(companyId, regularizationId, decision, rejectionReason = null, actor = {}) {
    const reg = await prisma.attendanceRegularization.findFirst({
      where: { id: regularizationId, companyId },
      include: { profile: true },
    });
    if (!reg) throw attError('Regularization request not found.', 404);
    if (reg.status !== 'PENDING') {
      throw attError(`Cannot process regularization in ${reg.status} status.`, 409);
    }

    // Segregation of Duties: Employee cannot approve their own regularization
    const actorUserId = actor.userId || actor.id;
    if (decision === 'APPROVED' && reg.profile?.employeeId && actorUserId && String(reg.profile.employeeId) === String(actorUserId)) {
      throw attError('Segregation of Duties Violation: You cannot approve your own attendance regularization.', 403);
    }

    const isApprove = decision === 'APPROVED';
    const now = new Date();
    const actorId = String(actor.userId || actor.id || 'admin');

    const updatedReg = await prisma.attendanceRegularization.update({
      where: { id: regularizationId },
      data: {
        status: isApprove ? 'APPROVED' : 'REJECTED',
        approvedById: isApprove ? actorId : null,
        approvedAt: isApprove ? now : null,
        rejectionReason: !isApprove ? rejectionReason || 'Rejected by approver' : null,
      },
    });

    if (isApprove) {
      // Upsert DailyAttendance with regularized times
      const existing = await prisma.dailyAttendance.findUnique({
        where: {
          companyId_employeeProfileId_attendanceDate: {
            companyId,
            employeeProfileId: reg.employeeProfileId,
            attendanceDate: reg.attendanceDate,
          },
        },
      });

      const inTime = reg.requestedInTime || existing?.firstInTime || new Date(reg.attendanceDate);
      const outTime = reg.requestedOutTime || existing?.lastOutTime || new Date(reg.attendanceDate.getTime() + 8 * 60 * 60 * 1000);

      const shift = await prisma.shiftPolicy.findFirst({
        where: { companyId, isDefault: true },
      });
      const metrics = this.calculateAttendanceMetrics(inTime, outTime, shift);

      if (existing) {
        await prisma.dailyAttendance.update({
          where: { id: existing.id },
          data: {
            firstInTime: inTime,
            lastOutTime: outTime,
            totalWorkHours: metrics.totalWorkHours,
            breakHours: metrics.breakHours,
            overtimeHours: metrics.overtimeHours,
            lateMinutes: 0, // Waived via regularization
            earlyExitMinutes: 0,
            status: metrics.status === 'ABSENT' ? 'PRESENT' : metrics.status,
            isRegularized: true,
            regularizationId: reg.id,
          },
        });
      } else {
        await prisma.dailyAttendance.create({
          data: {
            companyId,
            employeeProfileId: reg.employeeProfileId,
            attendanceDate: reg.attendanceDate,
            shiftId: shift?.id,
            firstInTime: inTime,
            lastOutTime: outTime,
            totalWorkHours: metrics.totalWorkHours,
            breakHours: metrics.breakHours,
            overtimeHours: metrics.overtimeHours,
            status: 'PRESENT',
            isRegularized: true,
            regularizationId: reg.id,
            source: 'REGULARIZED',
          },
        });
      }
    }

    await auditService.logAction({
      companyId,
      actor,
      action: isApprove ? 'APPROVE_ATTENDANCE_REGULARIZATION' : 'REJECT_ATTENDANCE_REGULARIZATION',
      entityType: 'ATTENDANCE_REGULARIZATION',
      entityId: reg.id,
      afterState: { status: updatedReg.status },
      reason: rejectionReason || (isApprove ? 'Approved attendance regularization' : 'Rejected'),
    });

    return updatedReg;
  },

  // =========================================================================
  // 3. MONTHLY ATTENDANCE AGGREGATION (FOR PAYROLL)
  // =========================================================================

  async getMonthlyAggregation(companyId, month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const totalMonthDays = new Date(year, month, 0).getDate();

    const profiles = await prisma.employeeProfile.findMany({
      where: { companyId, employmentStatus: 'ACTIVE' },
      select: { id: true, employeeCode: true, displayName: true },
    });

    const attendances = await prisma.dailyAttendance.findMany({
      where: {
        companyId,
        attendanceDate: { gte: startDate, lte: endDate },
      },
    });

    // Approved leaves in the month
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        companyId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { leaveType: true },
    });

    const aggregationMap = {};

    for (const p of profiles) {
      aggregationMap[p.id] = {
        employeeProfileId: p.id,
        employeeCode: p.employeeCode,
        displayName: p.displayName,
        totalCalendarDays: totalMonthDays,
        presentDays: 0,
        halfDays: 0,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weeklyOffDays: 0,
        overtimeHours: 0,
        lopDays: 0,
        paidDays: 0,
      };
    }

    for (const att of attendances) {
      if (!aggregationMap[att.employeeProfileId]) continue;
      const rec = aggregationMap[att.employeeProfileId];
      if (att.status === 'PRESENT') {
        rec.presentDays += 1;
      } else if (att.status === 'HALF_DAY') {
        rec.halfDays += 1;
      } else if (att.status === 'WEEKLY_OFF') {
        rec.weeklyOffDays += 1;
      }
      rec.overtimeHours += Number(att.overtimeHours || 0);
    }

    for (const lv of approvedLeaves) {
      if (!aggregationMap[lv.employeeProfileId]) continue;
      const rec = aggregationMap[lv.employeeProfileId];
      const count = Number(lv.daysCount || 0);
      if (lv.leaveType?.isPaid) {
        rec.paidLeaveDays += count;
      } else {
        rec.unpaidLeaveDays += count;
      }
    }

    // Compute standard working / paid days
    for (const pid of Object.keys(aggregationMap)) {
      const rec = aggregationMap[pid];
      const effectivePresent = rec.presentDays + rec.halfDays * 0.5;
      // Default: Assuming 30 or total calendar days, unworked days without paid leave = LOP
      const workedOrPaid = effectivePresent + rec.paidLeaveDays;
      // If employee had recorded attendance or leaves, calculate LOP
      rec.paidDays = Math.min(totalMonthDays, workedOrPaid > 0 ? workedOrPaid : totalMonthDays);
      rec.lopDays = Math.max(0, totalMonthDays - rec.paidDays);
    }

    return aggregationMap;
  },
};

export default attendanceService;

