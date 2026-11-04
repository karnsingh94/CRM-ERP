import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { approvalService } from '../approval.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function leaveError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const leaveService = {
  // =========================================================================
  // 1. LEAVE TYPES & POLICIES
  // =========================================================================

  async createLeaveType(companyId, data, actor = {}) {
    const { name, code, isPaid = true, isEncashable = false, allowHalfDay = true, description } = data;
    if (!name || !code) {
      throw leaveError('Leave type name and code are required.');
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await prisma.leaveType.findUnique({
      where: { companyId_code: { companyId, code: cleanCode } },
    });
    if (existing) {
      throw leaveError(`Leave type "${cleanCode}" already exists for this company.`, 409);
    }

    const type = await prisma.leaveType.create({
      data: {
        companyId,
        name: name.trim(),
        code: cleanCode,
        isPaid: Boolean(isPaid),
        isEncashable: Boolean(isEncashable),
        allowHalfDay: Boolean(allowHalfDay),
        description: description ? description.trim() : null,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_LEAVE_TYPE',
      entityType: 'LEAVE_TYPE',
      entityId: type.id,
      afterState: type,
      reason: `Created leave type ${type.name} (${type.code})`,
    });

    return type;
  },

  async listLeaveTypes(companyId) {
    return prisma.leaveType.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { policies: true },
      orderBy: { name: 'asc' },
    });
  },

  async createLeavePolicy(companyId, data, actor = {}) {
    const {
      leaveTypeId,
      annualQuota,
      accrualFrequency = 'MONTHLY',
      maxCarryForward = 0,
      minNoticeDays = 0,
      sandwichRuleEnabled = false,
      effectiveFrom,
    } = data;

    if (!leaveTypeId || annualQuota === undefined || !effectiveFrom) {
      throw leaveError('leaveTypeId, annualQuota, and effectiveFrom are required.');
    }

    const lt = await prisma.leaveType.findFirst({
      where: { id: leaveTypeId, companyId },
    });
    if (!lt) throw leaveError('Invalid leaveTypeId for this company.', 404);

    const policy = await prisma.leavePolicy.create({
      data: {
        companyId,
        leaveTypeId,
        annualQuota: new Decimal(annualQuota),
        accrualFrequency,
        maxCarryForward: new Decimal(maxCarryForward || 0),
        minNoticeDays: Number(minNoticeDays) || 0,
        sandwichRuleEnabled: Boolean(sandwichRuleEnabled),
        effectiveFrom: new Date(effectiveFrom),
      },
      include: { leaveType: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_LEAVE_POLICY',
      entityType: 'LEAVE_POLICY',
      entityId: policy.id,
      afterState: policy,
      reason: `Created leave policy for ${lt.name}`,
    });

    return policy;
  },

  async listLeavePolicies(companyId) {
    return prisma.leavePolicy.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { leaveType: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  },

  // =========================================================================
  // 2. LEAVE BALANCES
  // =========================================================================

  async getLeaveBalances(companyId, employeeProfileId, year = new Date().getFullYear()) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw leaveError('Employee profile not found.', 404);

    const types = await prisma.leaveType.findMany({
      where: { companyId, status: 'ACTIVE' },
    });

    const balances = await prisma.employeeLeaveBalance.findMany({
      where: { companyId, employeeProfileId, year: Number(year) },
      include: { leaveType: true },
    });

    const balanceMap = new Map(balances.map((b) => [b.leaveTypeId, b]));

    // Auto-provision balance rows for missing leave types
    const results = [];
    for (const lt of types) {
      if (balanceMap.has(lt.id)) {
        results.push(balanceMap.get(lt.id));
      } else {
        const policy = await prisma.leavePolicy.findFirst({
          where: { companyId, leaveTypeId: lt.id, status: 'ACTIVE' },
          orderBy: { effectiveFrom: 'desc' },
        });
        const quota = policy ? policy.annualQuota : new Decimal(0);
        const newBal = await prisma.employeeLeaveBalance.create({
          data: {
            companyId,
            employeeProfileId,
            leaveTypeId: lt.id,
            year: Number(year),
            openingBalance: quota,
            accrued: quota,
            used: new Decimal(0),
            encashed: new Decimal(0),
            currentBalance: quota,
          },
          include: { leaveType: true },
        });
        results.push(newBal);
      }
    }

    return results;
  },

  // =========================================================================
  // 3. LEAVE APPLICATION & APPROVAL WORKFLOW
  // =========================================================================

  async applyLeave(companyId, data, actor = {}) {
    const {
      employeeProfileId,
      leaveTypeId,
      startDate,
      endDate,
      isHalfDay = false,
      halfDaySession,
      reason,
    } = data;

    if (!employeeProfileId || !leaveTypeId || !startDate || !endDate || !reason) {
      throw leaveError('employeeProfileId, leaveTypeId, startDate, endDate, and reason are required.');
    }

    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw leaveError('Employee profile not found.', 404);

    const lt = await prisma.leaveType.findFirst({
      where: { id: leaveTypeId, companyId },
    });
    if (!lt) throw leaveError('Leave type not found.', 404);

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    if (sDate > eDate) {
      throw leaveError('startDate cannot be after endDate.');
    }

    // Calculate days count
    let daysCount = 1;
    if (isHalfDay) {
      if (!lt.allowHalfDay) {
        throw leaveError(`Half-day leave is not allowed for leave type "${lt.name}".`);
      }
      daysCount = 0.5;
    } else {
      const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
      daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Check overlapping leave requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        companyId,
        employeeProfileId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { startDate: { lte: eDate }, endDate: { gte: sDate } },
        ],
      },
    });
    if (overlapping) {
      throw leaveError(`An overlapping leave request (${overlapping.status}) already exists for this period.`, 409);
    }

    // Check leave balance if it is a paid leave type
    const year = sDate.getFullYear();
    const balances = await this.getLeaveBalances(companyId, employeeProfileId, year);
    const balRec = balances.find((b) => b.leaveTypeId === leaveTypeId);

    if (lt.isPaid && balRec) {
      const available = new Decimal(balRec.currentBalance);
      if (available.lessThan(daysCount)) {
        throw leaveError(
          `Insufficient leave balance. Requested: ${daysCount} days, Available: ${available.toFixed(2)} days.`
        );
      }
    }

    const leaveReq = await prisma.leaveRequest.create({
      data: {
        companyId,
        employeeProfileId,
        leaveTypeId,
        startDate: sDate,
        endDate: eDate,
        isHalfDay: Boolean(isHalfDay),
        halfDaySession: isHalfDay ? halfDaySession || 'FIRST_HALF' : null,
        daysCount: new Decimal(daysCount),
        reason: reason.trim(),
        status: 'PENDING',
      },
    });

    // Submit to Approval Engine
    const appReq = await approvalService.createRequest({
      companyId,
      entityType: 'LEAVE_REQUEST',
      entityId: leaveReq.id,
      title: `Leave Application: ${profile.displayName} (${daysCount} days - ${lt.name})`,
      summary: reason.trim(),
      creatorId: actor.userId || actor.id,
      creatorName: actor.name || profile.displayName,
      role: actor.role || 'EMPLOYEE',
    });

    await prisma.leaveRequest.update({
      where: { id: leaveReq.id },
      data: { approvalRequestId: appReq.id },
    });

    return { ...leaveReq, approvalRequestId: appReq.id };
  },

  async approveLeave(companyId, leaveRequestId, actor = {}) {
    const leave = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, companyId },
      include: { profile: true, leaveType: true },
    });
    if (!leave) throw leaveError('Leave request not found.', 404);
    if (leave.status !== 'PENDING') {
      throw leaveError(`Cannot approve leave request in ${leave.status} status.`, 409);
    }

    // Segregation of Duties: Employee cannot approve their own leave application
    const actorUserId = actor.userId || actor.id;
    if (leave.profile?.employeeId && actorUserId && String(leave.profile.employeeId) === String(actorUserId)) {
      throw leaveError('Segregation of Duties Violation: You cannot approve your own leave application.', 403);
    }

    const year = leave.startDate.getFullYear();
    const daysToDeduct = new Decimal(leave.daysCount);

    return prisma.$transaction(async (tx) => {
      // Deduct balance atomically if paid leave
      if (leave.leaveType.isPaid) {
        let balance = await tx.employeeLeaveBalance.findUnique({
          where: {
            companyId_employeeProfileId_leaveTypeId_year: {
              companyId,
              employeeProfileId: leave.employeeProfileId,
              leaveTypeId: leave.leaveTypeId,
              year,
            },
          },
        });

        if (balance) {
          const newUsed = new Decimal(balance.used).add(daysToDeduct);
          const newCurrent = new Decimal(balance.currentBalance).sub(daysToDeduct);

          if (newCurrent.isNegative()) {
            throw leaveError(`Insufficient leave balance at approval time. Available: ${balance.currentBalance}`);
          }

          await tx.employeeLeaveBalance.update({
            where: { id: balance.id },
            data: { used: newUsed, currentBalance: newCurrent },
          });
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: {
          status: 'APPROVED',
          approvedById: String(actor.userId || actor.id || 'admin'),
          approvedAt: new Date(),
        },
      });

      await auditService.logAction({
        companyId,
        actor,
        action: 'APPROVE_LEAVE_REQUEST',
        entityType: 'LEAVE_REQUEST',
        entityId: leave.id,
        afterState: { status: 'APPROVED', daysCount: leave.daysCount },
        reason: `Approved ${leave.daysCount} days leave for ${leave.profile.displayName}`,
      });

      return updated;
    });
  },

  async rejectLeave(companyId, leaveRequestId, rejectionReason = null, actor = {}) {
    const leave = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, companyId },
    });
    if (!leave) throw leaveError('Leave request not found.', 404);
    if (leave.status !== 'PENDING') {
      throw leaveError(`Cannot reject leave request in ${leave.status} status.`, 409);
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason || 'Rejected by approver',
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'REJECT_LEAVE_REQUEST',
      entityType: 'LEAVE_REQUEST',
      entityId: leave.id,
      afterState: { status: 'REJECTED' },
      reason: rejectionReason || 'Rejected leave request',
    });

    return updated;
  },

  async cancelLeave(companyId, leaveRequestId, actor = {}) {
    const leave = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, companyId },
      include: { leaveType: true },
    });
    if (!leave) throw leaveError('Leave request not found.', 404);
    if (leave.status === 'CANCELLED') {
      throw leaveError('Leave request is already cancelled.');
    }

    const wasApproved = leave.status === 'APPROVED';
    const year = leave.startDate.getFullYear();
    const daysToRestore = new Decimal(leave.daysCount);

    return prisma.$transaction(async (tx) => {
      // Restore balance if was approved and paid
      if (wasApproved && leave.leaveType.isPaid) {
        const balance = await tx.employeeLeaveBalance.findUnique({
          where: {
            companyId_employeeProfileId_leaveTypeId_year: {
              companyId,
              employeeProfileId: leave.employeeProfileId,
              leaveTypeId: leave.leaveTypeId,
              year,
            },
          },
        });

        if (balance) {
          const newUsed = new Decimal(balance.used).sub(daysToRestore);
          const newCurrent = new Decimal(balance.currentBalance).add(daysToRestore);

          await tx.employeeLeaveBalance.update({
            where: { id: balance.id },
            data: { used: newUsed, currentBalance: newCurrent },
          });
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: 'CANCELLED' },
      });

      await auditService.logAction({
        companyId,
        actor,
        action: 'CANCEL_LEAVE_REQUEST',
        entityType: 'LEAVE_REQUEST',
        entityId: leave.id,
        afterState: { status: 'CANCELLED' },
        reason: `Cancelled leave and restored ${daysToRestore} days balance`,
      });

      return updated;
    });
  },

  async listLeaveRequests(companyId, filters = {}) {
    const { employeeProfileId, status, startDate, endDate } = filters;
    const where = { companyId };
    if (employeeProfileId) where.employeeProfileId = employeeProfileId;
    if (status) where.status = status;
    if (startDate) where.startDate = { gte: new Date(startDate) };
    if (endDate) where.endDate = { lte: new Date(endDate) };

    return prisma.leaveRequest.findMany({
      where,
      include: {
        profile: { select: { id: true, employeeCode: true, displayName: true } },
        leaveType: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export default leaveService;

