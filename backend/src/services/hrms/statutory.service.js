import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function statError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const statutoryService = {
  // =========================================================================
  // 1. STATUTORY RULE CONFIGURATION CRUD
  // =========================================================================

  async setRule(companyId, data, actor = {}) {
    const { ruleType, effectiveFrom, effectiveTo, configJson, notes } = data;
    if (!ruleType || !effectiveFrom || !configJson) {
      throw statError('ruleType, effectiveFrom, and configJson are required.');
    }

    const validTypes = ['EPF', 'ESIC', 'PROFESSIONAL_TAX', 'TDS'];
    const normType = ruleType.toUpperCase();
    if (!validTypes.includes(normType)) {
      throw statError(`Invalid ruleType. Allowed: ${validTypes.join(', ')}`);
    }

    const rule = await prisma.statutoryRule.create({
      data: {
        companyId,
        ruleType: normType,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        configJson,
        notes: notes ? notes.trim() : null,
        status: 'ACTIVE',
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'SET_STATUTORY_RULE',
      entityType: 'STATUTORY_RULE',
      entityId: rule.id,
      afterState: rule,
      reason: `Configured ${normType} statutory rule effective from ${rule.effectiveFrom.toISOString().split('T')[0]}`,
    });

    return rule;
  },

  async listRules(companyId, ruleType) {
    const where = { companyId };
    if (ruleType) where.ruleType = ruleType.toUpperCase();
    return prisma.statutoryRule.findMany({
      where,
      orderBy: { effectiveFrom: 'desc' },
    });
  },

  async getEffectiveRule(companyId, ruleType, asOfDate = new Date()) {
    const normType = ruleType.toUpperCase();
    const d = new Date(asOfDate);

    const rule = await prisma.statutoryRule.findFirst({
      where: {
        companyId,
        ruleType: normType,
        status: 'ACTIVE',
        effectiveFrom: { lte: d },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: d } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return rule;
  },

  // =========================================================================
  // 2. CONFIGURABLE STATUTORY COMPUTATIONS (USING PRISMA DECIMAL)
  // =========================================================================

  /**
   * Calculate EPF (Employee & Employer)
   */
  async calculateEpf(companyId, pfWage, asOfDate = new Date()) {
    const wage = new Decimal(pfWage || 0);
    const rule = await this.getEffectiveRule(companyId, 'EPF', asOfDate);

    // Default statutory benchmark if not customized in DB: 12% employee, 12% employer, wage ceiling 15000
    const config = rule?.configJson || {
      employeeRatePct: 12.0,
      employerRatePct: 12.0,
      wageCeiling: 15000.0,
      enforceCeiling: true,
      epsRatePct: 8.33,
      epfEmployerDifferencePct: 3.67,
    };

    let eligibleWage = wage;
    if (config.enforceCeiling && config.wageCeiling) {
      eligibleWage = Decimal.min(wage, new Decimal(config.wageCeiling));
    }

    const empRate = new Decimal(config.employeeRatePct || 12).div(100);
    const emplyrRate = new Decimal(config.employerRatePct || 12).div(100);
    const epsRate = new Decimal(config.epsRatePct || 8.33).div(100);
    const epfDiffRate = new Decimal(config.epfEmployerDifferencePct || 3.67).div(100);

    const employeePf = eligibleWage.mul(empRate).toDecimalPlaces(2);
    const employerPfTotal = eligibleWage.mul(emplyrRate).toDecimalPlaces(2);
    const employerEps = eligibleWage.mul(epsRate).toDecimalPlaces(2);
    const employerEpfDiff = employerPfTotal.sub(employerEps);

    return {
      ruleSource: rule ? 'DATABASE_CONFIG' : 'SYSTEM_BENCHMARK',
      ruleId: rule?.id || null,
      eligibleWage: eligibleWage.toNumber(),
      employeePf: employeePf.toNumber(),
      employerPf: employerPfTotal.toNumber(),
      employerEps: employerEps.toNumber(),
      employerEpfDiff: employerEpfDiff.toNumber(),
      legalDisclaimer: 'Statutory calculation based on company rule configuration. Verify with CA before production filing.',
    };
  },

  /**
   * Calculate ESIC (Employee & Employer)
   */
  async calculateEsic(companyId, grossWage, asOfDate = new Date()) {
    const wage = new Decimal(grossWage || 0);
    const rule = await this.getEffectiveRule(companyId, 'ESIC', asOfDate);

    // Default benchmark: Employee 0.75%, Employer 3.25%, ceiling 21000
    const config = rule?.configJson || {
      employeeRatePct: 0.75,
      employerRatePct: 3.25,
      grossThreshold: 21000.0,
    };

    if (config.grossThreshold && wage.greaterThan(new Decimal(config.grossThreshold))) {
      return {
        ruleSource: rule ? 'DATABASE_CONFIG' : 'SYSTEM_BENCHMARK',
        ruleId: rule?.id || null,
        isEligible: false,
        employeeEsic: 0,
        employerEsic: 0,
        reason: `Gross wage (${wage.toFixed(2)}) exceeds ESIC threshold (${config.grossThreshold}).`,
      };
    }

    const empRate = new Decimal(config.employeeRatePct || 0.75).div(100);
    const emplyrRate = new Decimal(config.employerRatePct || 3.25).div(100);

    const employeeEsic = wage.mul(empRate).ceil(); // Standard ESIC rounds up to next rupee
    const employerEsic = wage.mul(emplyrRate).ceil();

    return {
      ruleSource: rule ? 'DATABASE_CONFIG' : 'SYSTEM_BENCHMARK',
      ruleId: rule?.id || null,
      isEligible: true,
      employeeEsic: employeeEsic.toNumber(),
      employerEsic: employerEsic.toNumber(),
      legalDisclaimer: 'Statutory calculation based on company rule configuration. Verify with CA before production filing.',
    };
  },

  /**
   * Calculate Professional Tax (PT) by State Slab
   */
  async calculateProfessionalTax(companyId, grossWage, state = 'MAHARASHTRA', month = new Date().getMonth() + 1, asOfDate = new Date()) {
    const wage = new Decimal(grossWage || 0).toNumber();
    const rule = await this.getEffectiveRule(companyId, 'PROFESSIONAL_TAX', asOfDate);

    // Default benchmark Maharashtra slabs if not customized
    const defaultSlabs = [
      { min: 0, max: 7500, tax: 0 },
      { min: 7501, max: 10000, tax: 175 },
      { min: 10001, max: null, tax: 200, februaryTax: 300 },
    ];

    const slabs = rule?.configJson?.slabs || defaultSlabs;
    let ptAmount = 0;

    for (const slab of slabs) {
      const min = slab.min || 0;
      const max = slab.max !== null && slab.max !== undefined ? slab.max : Infinity;
      if (wage >= min && wage <= max) {
        if (month === 2 && slab.februaryTax) {
          ptAmount = slab.februaryTax;
        } else {
          ptAmount = slab.tax;
        }
        break;
      }
    }

    return {
      ruleSource: rule ? 'DATABASE_CONFIG' : 'SYSTEM_BENCHMARK',
      ruleId: rule?.id || null,
      state: rule?.configJson?.state || state,
      ptAmount,
      legalDisclaimer: 'Statutory calculation based on state-specific slab rules. Verify with CA before filing.',
    };
  },

  /**
   * Calculate Monthly TDS Withholding
   */
  async calculateTds(companyId, taxableIncomeMonthly, asOfDate = new Date()) {
    const wage = new Decimal(taxableIncomeMonthly || 0);
    const rule = await this.getEffectiveRule(companyId, 'TDS', asOfDate);

    // Default: If no TDS rule set, 0 withholding (or flat percentage if specified in config)
    const flatPct = rule?.configJson?.flatRatePct || 0;
    const tdsAmount = wage.mul(new Decimal(flatPct).div(100)).toDecimalPlaces(2);

    return {
      ruleSource: rule ? 'DATABASE_CONFIG' : 'SYSTEM_BENCHMARK',
      ruleId: rule?.id || null,
      tdsAmount: tdsAmount.toNumber(),
      legalDisclaimer: 'TDS estimate based on configured parameters. Annual reconciliation required.',
    };
  },
};

export default statutoryService;

