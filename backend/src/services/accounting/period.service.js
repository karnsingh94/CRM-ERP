import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';

function periodError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const periodService = {
  // =========================================================================
  // 1. FINANCIAL YEAR MANAGEMENT
  // =========================================================================

  async createFinancialYear(companyId, data, actor = {}) {
    const { name, code, startDate, endDate, isCurrent = false } = data;

    if (!name || !code || !startDate || !endDate) {
      throw periodError('name, code, startDate, and endDate are required.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw periodError('Invalid startDate or endDate format.');
    }

    if (start >= end) {
      throw periodError('startDate must be earlier than endDate.');
    }

    // Check duplicate code
    const existingCode = await prisma.financialYear.findFirst({
      where: { companyId, code: code.trim().toUpperCase() },
    });
    if (existingCode) {
      throw periodError(`Financial Year with code '${code}' already exists for this company.`);
    }

    // Prevent overlapping financial years within the company
    const overlapping = await prisma.financialYear.findFirst({
      where: {
        companyId,
        AND: [
          { startDate: { lte: end } },
          { endDate: { gte: start } },
        ],
      },
    });
    if (overlapping) {
      throw periodError(
        `Financial Year dates (${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}) overlap with existing fiscal year ${overlapping.name} (${overlapping.code}).`
      );
    }

    return prisma.$transaction(async (tx) => {
      if (isCurrent) {
        // Demote previous current year
        await tx.financialYear.updateMany({
          where: { companyId, isCurrent: true },
          data: { isCurrent: false },
        });
      }

      const fy = await tx.financialYear.create({
        data: {
          companyId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          startDate: start,
          endDate: end,
          isCurrent: Boolean(isCurrent),
          isLocked: false,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Financial Controller',
        action: 'FINANCIAL_YEAR_CREATE',
        serviceCode: 'accounts_banking',
        moduleCode: 'general_ledger',
        details: `Created Financial Year ${fy.name} (${fy.code}) from ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}.`,
      });

      return fy;
    });
  },

  async listFinancialYears(companyId) {
    return prisma.financialYear.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
      include: {
        periods: {
          orderBy: { periodNumber: 'asc' },
        },
        _count: {
          select: { vouchers: true, salesInvoices: true },
        },
      },
    });
  },

  async getFinancialYearById(companyId, fyId) {
    const fy = await prisma.financialYear.findFirst({
      where: { id: fyId, companyId },
      include: {
        periods: {
          orderBy: { periodNumber: 'asc' },
        },
      },
    });
    if (!fy) {
      throw periodError(`Financial Year not found with id ${fyId}.`, 404);
    }
    return fy;
  },

  async setCurrentFinancialYear(companyId, fyId, actor = {}) {
    const fy = await this.getFinancialYearById(companyId, fyId);

    await prisma.$transaction(async (tx) => {
      await tx.financialYear.updateMany({
        where: { companyId, isCurrent: true },
        data: { isCurrent: false },
      });

      await tx.financialYear.update({
        where: { id: fyId },
        data: { isCurrent: true },
      });
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Financial Controller',
      action: 'FINANCIAL_YEAR_SET_CURRENT',
      serviceCode: 'accounts_banking',
      moduleCode: 'general_ledger',
      details: `Set ${fy.name} (${fy.code}) as the active Financial Year.`,
    });

    return { success: true, message: `Financial Year ${fy.name} is now current.` };
  },

  async lockFinancialYear(companyId, fyId, actor = {}) {
    const fy = await this.getFinancialYearById(companyId, fyId);
    if (fy.isLocked) {
      throw periodError(`Financial Year ${fy.name} is already locked.`);
    }

    const lockedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.financialYear.update({
        where: { id: fyId },
        data: {
          isLocked: true,
          lockedAt,
          lockedById: actor.id || actor.userId || null,
        },
      });

      // Also lock and close all accounting periods under this year
      await tx.accountingPeriod.updateMany({
        where: { financialYearId: fyId, companyId },
        data: {
          isClosed: true,
          closedAt: lockedAt,
          closedById: actor.id || actor.userId || null,
        },
      });
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Financial Controller',
      action: 'FINANCIAL_YEAR_LOCK',
      serviceCode: 'accounts_banking',
      moduleCode: 'general_ledger',
      details: `Permanently locked Financial Year ${fy.name} (${fy.code}) and closed all periods.`,
    });

    return { success: true, message: `Financial Year ${fy.name} locked permanently.` };
  },

  // =========================================================================
  // 2. ACCOUNTING PERIOD MANAGEMENT
  // =========================================================================

  async generateStandardPeriods(companyId, fyId, actor = {}) {
    const fy = await this.getFinancialYearById(companyId, fyId);

    // Check if periods already exist
    const existingCount = await prisma.accountingPeriod.count({
      where: { financialYearId: fyId, companyId },
    });
    if (existingCount > 0) {
      throw periodError(`Accounting periods already exist for Financial Year ${fy.name}.`);
    }

    // Generate 12 monthly periods from fy.startDate
    const periodsToCreate = [];
    let curDate = new Date(fy.startDate);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (let i = 1; i <= 12; i++) {
      const pStart = new Date(curDate.getFullYear(), curDate.getMonth(), 1);
      const pEnd = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 0, 23, 59, 59);

      const mName = monthNames[curDate.getMonth()];
      const yearStr = curDate.getFullYear();
      const periodName = `${mName} ${yearStr}`;
      const periodCode = `P${String(i).padStart(2, '0')}-${yearStr}`;

      periodsToCreate.push({
        companyId,
        financialYearId: fyId,
        periodName,
        periodCode,
        periodNumber: i,
        startDate: pStart,
        endDate: pEnd,
        isClosed: false,
      });

      // Move to next month
      curDate.setMonth(curDate.getMonth() + 1);
    }

    await prisma.accountingPeriod.createMany({
      data: periodsToCreate,
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Financial Controller',
      action: 'ACCOUNTING_PERIODS_GENERATE',
      serviceCode: 'accounts_banking',
      moduleCode: 'general_ledger',
      details: `Generated 12 standard monthly accounting periods for Financial Year ${fy.name}.`,
    });

    return this.listPeriods(companyId, fyId);
  },

  async createPeriod(companyId, data, actor = {}) {
    const { financialYearId, periodName, periodCode, periodNumber, startDate, endDate } = data;

    if (!financialYearId || !periodName || !periodCode || !periodNumber || !startDate || !endDate) {
      throw periodError('financialYearId, periodName, periodCode, periodNumber, startDate, and endDate are required.');
    }

    const fy = await this.getFinancialYearById(companyId, financialYearId);
    if (fy.isLocked) {
      throw periodError('Cannot create period in a locked Financial Year.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw periodError('startDate must be earlier than endDate.');
    }

    // Verify dates fit inside parent FY
    if (start < fy.startDate || end > fy.endDate) {
      throw periodError(`Period dates must fall within Financial Year bounds (${fy.startDate.toISOString().slice(0, 10)} to ${fy.endDate.toISOString().slice(0, 10)}).`);
    }

    // Check duplicate period code or period number in FY
    const duplicate = await prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        OR: [
          { periodCode: periodCode.trim().toUpperCase() },
          { financialYearId, periodNumber: Number(periodNumber) },
        ],
      },
    });
    if (duplicate) {
      throw periodError(`Period code '${periodCode}' or period number ${periodNumber} is already in use.`);
    }

    // Prevent overlapping periods within this FY
    const overlap = await prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        financialYearId,
        AND: [
          { startDate: { lte: end } },
          { endDate: { gte: start } },
        ],
      },
    });
    if (overlap) {
      throw periodError(`Period dates overlap with existing period ${overlap.periodName} (${overlap.periodCode}).`);
    }

    const period = await prisma.accountingPeriod.create({
      data: {
        companyId,
        financialYearId,
        periodName: periodName.trim(),
        periodCode: periodCode.trim().toUpperCase(),
        periodNumber: Number(periodNumber),
        startDate: start,
        endDate: end,
        isClosed: false,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Financial Controller',
      action: 'ACCOUNTING_PERIOD_CREATE',
      serviceCode: 'accounts_banking',
      moduleCode: 'general_ledger',
      details: `Created Accounting Period ${period.periodName} (${period.periodCode}) in FY ${fy.name}.`,
    });

    return period;
  },

  async listPeriods(companyId, financialYearId) {
    const where = { companyId };
    if (financialYearId) where.financialYearId = financialYearId;

    return prisma.accountingPeriod.findMany({
      where,
      orderBy: [{ financialYearId: 'asc' }, { periodNumber: 'asc' }],
      include: {
        financialYear: true,
      },
    });
  },

  async getPeriodById(companyId, periodId) {
    const period = await prisma.accountingPeriod.findFirst({
      where: { id: periodId, companyId },
      include: {
        financialYear: true,
      },
    });
    if (!period) {
      throw periodError(`Accounting period not found with id ${periodId}.`, 404);
    }
    return period;
  },

  async closePeriod(companyId, periodId, actor = {}) {
    const period = await this.getPeriodById(companyId, periodId);
    if (period.isClosed) {
      throw periodError(`Accounting Period ${period.periodName} is already closed.`);
    }

    const updated = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        isClosed: true,
        closedAt: new Date(),
        closedById: actor.id || actor.userId || null,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Financial Controller',
      action: 'ACCOUNTING_PERIOD_CLOSE',
      serviceCode: 'accounts_banking',
      moduleCode: 'general_ledger',
      details: `Closed Accounting Period ${period.periodName} (${period.periodCode}). Transactions are now blocked.`,
    });

    return updated;
  },

  async reopenPeriod(companyId, periodId, reason, actor = {}) {
    if (!reason || reason.trim().length < 5) {
      throw periodError('A valid authorization reason is required to reopen a closed accounting period.');
    }

    const period = await this.getPeriodById(companyId, periodId);
    if (!period.isClosed) {
      throw periodError(`Accounting Period ${period.periodName} is already open.`);
    }

    // Safety Rule: Never silently reopen a locked financial year!
    if (period.financialYear && period.financialYear.isLocked) {
      throw periodError(`Cannot reopen period ${period.periodName}: its parent Financial Year (${period.financialYear.name}) is locked.`);
    }

    const updated = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        isClosed: false,
        closedAt: null,
        closedById: null,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Financial Controller',
      action: 'ACCOUNTING_PERIOD_REOPEN',
      serviceCode: 'accounts_banking',
      moduleCode: 'general_ledger',
      details: `Reopened closed Accounting Period ${period.periodName} (${period.periodCode}). Reason: ${reason}`,
    });

    return updated;
  },
};

export default periodService;

