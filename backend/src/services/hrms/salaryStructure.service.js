import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function salError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const salaryStructureService = {
  // =========================================================================
  // 1. SALARY COMPONENTS
  // =========================================================================

  async createComponent(companyId, data, actor = {}) {
    const {
      name,
      code,
      type,
      calculationType = 'FLAT',
      isTaxable = true,
      isStatutory = false,
      ledgerAccountId,
      displayOrder = 1,
      status = 'ACTIVE',
    } = data;

    if (!name || !code || !type) {
      throw salError('name, code, and type (EARNING / DEDUCTION) are required.');
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await prisma.salaryComponent.findUnique({
      where: { companyId_code: { companyId, code: cleanCode } },
    });
    if (existing) {
      throw salError(`Salary component "${cleanCode}" already exists for this company.`, 409);
    }

    const comp = await prisma.salaryComponent.create({
      data: {
        companyId,
        name: name.trim(),
        code: cleanCode,
        type: type.toUpperCase(),
        calculationType: calculationType.toUpperCase(),
        isTaxable: Boolean(isTaxable),
        isStatutory: Boolean(isStatutory),
        ledgerAccountId: ledgerAccountId || null,
        displayOrder: Number(displayOrder) || 1,
        status,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_SALARY_COMPONENT',
      entityType: 'SALARY_COMPONENT',
      entityId: comp.id,
      afterState: comp,
      reason: `Created salary component ${comp.name} (${comp.code})`,
    });

    return comp;
  },

  async listComponents(companyId, type) {
    const where = { companyId };
    if (type) where.type = type.toUpperCase();
    return prisma.salaryComponent.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
  },

  // =========================================================================
  // 2. SALARY STRUCTURE TEMPLATES
  // =========================================================================

  async createStructure(companyId, data, actor = {}) {
    const { name, code, description, componentsJson, status = 'ACTIVE' } = data;
    if (!name || !code || !componentsJson) {
      throw salError('name, code, and componentsJson are required.');
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await prisma.salaryStructure.findUnique({
      where: { companyId_code: { companyId, code: cleanCode } },
    });
    if (existing) {
      throw salError(`Salary structure "${cleanCode}" already exists for this company.`, 409);
    }

    const structure = await prisma.salaryStructure.create({
      data: {
        companyId,
        name: name.trim(),
        code: cleanCode,
        description: description ? description.trim() : null,
        componentsJson,
        status,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_SALARY_STRUCTURE',
      entityType: 'SALARY_STRUCTURE',
      entityId: structure.id,
      afterState: structure,
      reason: `Created salary structure ${structure.name} (${structure.code})`,
    });

    return structure;
  },

  async listStructures(companyId) {
    return prisma.salaryStructure.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  },

  async getStructureById(companyId, id) {
    const structure = await prisma.salaryStructure.findFirst({
      where: { id, companyId },
    });
    if (!structure) throw salError('Salary structure template not found.', 404);
    return structure;
  },

  // =========================================================================
  // 3. EMPLOYEE SALARY ASSIGNMENT (EFFECTIVE-DATED WITH PRISMA DECIMAL)
  // =========================================================================

  /**
   * Break down annual CTC into monthly components with Prisma Decimal precision
   */
  computeComponentBreakdown(monthlyCtcDecimal, structureComponents) {
    const breakdown = {
      earnings: [],
      deductions: [],
      totalEarnings: new Decimal(0),
      totalDeductions: new Decimal(0),
      netMonthly: new Decimal(0),
    };

    let allocatedEarnings = new Decimal(0);
    const mCtc = new Decimal(monthlyCtcDecimal);

    // 1. Process earnings
    for (const item of structureComponents.filter((c) => c.type === 'EARNING')) {
      let amount = new Decimal(0);
      if (item.formulaType === 'PERCENTAGE_OF_CTC') {
        const pct = new Decimal(item.value || 0).div(100);
        amount = mCtc.mul(pct).toDecimalPlaces(2);
      } else if (item.formulaType === 'FLAT') {
        amount = new Decimal(item.value || 0).toDecimalPlaces(2);
      }
      breakdown.earnings.push({
        code: item.code,
        name: item.name,
        amount: amount.toNumber(),
      });
      allocatedEarnings = allocatedEarnings.add(amount);
    }

    // Special allowance handles remaining CTC balance
    const specialAllowance = Decimal.max(0, mCtc.sub(allocatedEarnings));
    if (specialAllowance.greaterThan(0)) {
      breakdown.earnings.push({
        code: 'SPECIAL_ALLOWANCE',
        name: 'Special / Balancing Allowance',
        amount: specialAllowance.toNumber(),
      });
      allocatedEarnings = allocatedEarnings.add(specialAllowance);
    }
    breakdown.totalEarnings = allocatedEarnings;

    // 2. Process standard deductions
    for (const item of structureComponents.filter((c) => c.type === 'DEDUCTION')) {
      let amount = new Decimal(0);
      if (item.formulaType === 'PERCENTAGE_OF_BASIC') {
        const basicItem = breakdown.earnings.find((e) => e.code === 'BASIC');
        const basicAmt = basicItem ? new Decimal(basicItem.amount) : new Decimal(0);
        amount = basicAmt.mul(new Decimal(item.value || 0).div(100)).toDecimalPlaces(2);
      } else if (item.formulaType === 'FLAT') {
        amount = new Decimal(item.value || 0).toDecimalPlaces(2);
      }
      breakdown.deductions.push({
        code: item.code,
        name: item.name,
        amount: amount.toNumber(),
      });
      breakdown.totalDeductions = breakdown.totalDeductions.add(amount);
    }

    breakdown.netMonthly = breakdown.totalEarnings.sub(breakdown.totalDeductions);
    return breakdown;
  },

  async assignSalary(companyId, data, actor = {}) {
    const {
      employeeProfileId,
      salaryStructureId,
      ctcAnnual,
      effectiveFrom,
      revisionReason,
    } = data;

    if (!employeeProfileId || !salaryStructureId || !ctcAnnual || !effectiveFrom) {
      throw salError('employeeProfileId, salaryStructureId, ctcAnnual, and effectiveFrom are required.');
    }

    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw salError('Employee profile not found.', 404);

    const structure = await this.getStructureById(companyId, salaryStructureId);

    const annualDec = new Decimal(ctcAnnual);
    if (annualDec.lessThanOrEqualTo(0)) {
      throw salError('ctcAnnual must be greater than zero.');
    }
    const monthlyDec = annualDec.div(12).toDecimalPlaces(2);

    const components = Array.isArray(structure.componentsJson)
      ? structure.componentsJson
      : JSON.parse(structure.componentsJson || '[]');

    const breakdown = this.computeComponentBreakdown(monthlyDec, components);
    const effFromDate = new Date(effectiveFrom);

    return prisma.$transaction(async (tx) => {
      // Close previous active assignment if exists
      const prevActive = await tx.employeeSalaryAssignment.findFirst({
        where: {
          companyId,
          employeeProfileId,
          status: 'ACTIVE',
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (prevActive) {
        const prevEndDate = new Date(effFromDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);

        await tx.employeeSalaryAssignment.update({
          where: { id: prevActive.id },
          data: {
            status: 'SUPERSEDED',
            effectiveTo: prevEndDate,
          },
        });
      }

      const assignment = await tx.employeeSalaryAssignment.create({
        data: {
          companyId,
          employeeProfileId,
          salaryStructureId,
          ctcAnnual: annualDec,
          ctcMonthly: monthlyDec,
          effectiveFrom: effFromDate,
          effectiveTo: null,
          revisionReason: revisionReason ? revisionReason.trim() : 'Initial Salary Assignment',
          componentsBreakdown: breakdown,
          status: 'ACTIVE',
        },
        include: { structure: true },
      });

      await auditService.logAction({
        companyId,
        actor,
        action: 'ASSIGN_SALARY',
        entityType: 'EMPLOYEE_SALARY_ASSIGNMENT',
        entityId: assignment.id,
        details: { ctcAnnual: annualDec.toNumber(), ctcMonthly: monthlyDec.toNumber(), effectiveFrom },
        reason: `Assigned CTC ₹${annualDec.toFixed(2)} to ${profile.displayName} (${profile.employeeCode})`,
      });

      return assignment;
    });
  },

  async getSalaryHistory(companyId, employeeProfileId) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw salError('Employee profile not found.', 404);

    return prisma.employeeSalaryAssignment.findMany({
      where: { companyId, employeeProfileId },
      include: { structure: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  },
};

export default salaryStructureService;

