import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { approvalService } from '../approval.service.js';
import { attendanceService } from './attendance.service.js';
import { statutoryService } from './statutory.service.js';
import { standardAccountsService } from '../accounting/standardAccounts.service.js';
import { voucherService } from '../accounting/voucher.service.js';
import { generateSecureToken } from '../../utils/encryption.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function payrollError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const payrollService = {
  // =========================================================================
  // 1. CREATE PAYROLL BATCH (DRAFT)
  // =========================================================================

  async createBatch(companyId, { month, year }, actor = {}) {
    const m = Number(month);
    const y = Number(year);
    if (!m || !y || m < 1 || m > 12 || y < 2020 || y > 2100) {
      throw payrollError('Valid month (1-12) and year are required.');
    }

    const existing = await prisma.payrollBatch.findUnique({
      where: { companyId_month_year: { companyId, month: m, year: y } },
    });
    if (existing) {
      throw payrollError(`A payroll batch for ${m}/${y} already exists (Status: ${existing.status}).`, 409);
    }

    const periodStartDate = new Date(Date.UTC(y, m - 1, 1));
    const periodEndDate = new Date(Date.UTC(y, m, 0));
    const batchNumber = `PAY-${y}${String(m).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    const batch = await prisma.payrollBatch.create({
      data: {
        companyId,
        batchNumber,
        month: m,
        year: y,
        periodStartDate,
        periodEndDate,
        status: 'DRAFT',
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_PAYROLL_BATCH',
      entityType: 'PAYROLL_BATCH',
      entityId: batch.id,
      afterState: batch,
      reason: `Created payroll batch ${batch.batchNumber} for period ${m}/${y}`,
    });

    return batch;
  },

  // =========================================================================
  // 2. CALCULATE PAYROLL BATCH (CALCULATED)
  // =========================================================================

  async calculateBatch(companyId, batchId, actor = {}) {
    const batch = await prisma.payrollBatch.findFirst({
      where: { id: batchId, companyId },
    });
    if (!batch) throw payrollError('Payroll batch not found.', 404);
    if (batch.status !== 'DRAFT' && batch.status !== 'CALCULATED') {
      throw payrollError(`Cannot recalculate payroll batch in ${batch.status} status.`, 409);
    }

    const { month, year } = batch;
    const calendarDays = new Date(year, month, 0).getDate();

    // 1. Fetch eligible active employees with active salary assignments
    const employees = await prisma.employeeProfile.findMany({
      where: { companyId, employmentStatus: 'ACTIVE' },
      include: {
        salaryAssignments: {
          where: { status: 'ACTIVE' },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    if (employees.length === 0) {
      throw payrollError('No active employees found to calculate payroll for this company.', 400);
    }

    // 2. Fetch monthly attendance aggregation
    const attendanceAgg = await attendanceService.getMonthlyAggregation(companyId, month, year);

    let batchTotalGross = new Decimal(0);
    let batchTotalDeductions = new Decimal(0);
    let batchTotalNet = new Decimal(0);
    let batchTotalEmpPf = new Decimal(0);
    let batchTotalEmpEsi = new Decimal(0);

    const calculatedItems = [];

    for (const emp of employees) {
      const sal = emp.salaryAssignments[0];
      const monthlyCtc = sal ? new Decimal(sal.ctcMonthly) : new Decimal(0);

      const att = attendanceAgg[emp.id] || {
        paidDays: calendarDays,
        lopDays: 0,
        overtimeHours: 0,
      };

      const paidDaysDec = new Decimal(att.paidDays || calendarDays);
      const lopDaysDec = new Decimal(att.lopDays || 0);
      const prorationFactor = paidDaysDec.div(calendarDays);

      // Earnings
      const grossEarned = monthlyCtc.mul(prorationFactor).toDecimalPlaces(2);

      // Components breakdown
      let basicEarned = grossEarned.mul(0.5).toDecimalPlaces(2); // Standard benchmark: Basic is 50%
      let hraEarned = grossEarned.mul(0.2).toDecimalPlaces(2);
      let specialEarned = grossEarned.sub(basicEarned).sub(hraEarned);

      // Statutory deductions & contributions
      const asOfDate = new Date(year, month - 1, calendarDays);
      const epfResult = await statutoryService.calculateEpf(companyId, basicEarned, asOfDate);
      const esicResult = await statutoryService.calculateEsic(companyId, grossEarned, asOfDate);
      const ptResult = await statutoryService.calculateProfessionalTax(companyId, grossEarned, 'MAHARASHTRA', month, asOfDate);
      const tdsResult = await statutoryService.calculateTds(companyId, grossEarned, asOfDate);

      const empPfDec = new Decimal(epfResult.employeePf || 0);
      const emplyrPfDec = new Decimal(epfResult.employerPf || 0);
      const empEsiDec = new Decimal(esicResult.employeeEsic || 0);
      const emplyrEsiDec = new Decimal(esicResult.employerEsic || 0);
      const ptDec = new Decimal(ptResult.ptAmount || 0);
      const tdsDec = new Decimal(tdsResult.tdsAmount || 0);

      const totalDeductions = empPfDec.add(empEsiDec).add(ptDec).add(tdsDec);
      const netPayable = Decimal.max(0, grossEarned.sub(totalDeductions));

      const earningsBreakdown = [
        { code: 'BASIC', name: 'Basic Salary', amount: basicEarned.toNumber() },
        { code: 'HRA', name: 'House Rent Allowance', amount: hraEarned.toNumber() },
        { code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', amount: specialEarned.toNumber() },
      ];

      const deductionsBreakdown = [
        { code: 'EPF', name: 'Employee Provident Fund', amount: empPfDec.toNumber() },
        { code: 'ESIC', name: 'Employee State Insurance', amount: empEsiDec.toNumber() },
        { code: 'PT', name: 'Professional Tax', amount: ptDec.toNumber() },
        { code: 'TDS', name: 'Tax Deducted at Source', amount: tdsDec.toNumber() },
      ];

      batchTotalGross = batchTotalGross.add(grossEarned);
      batchTotalDeductions = batchTotalDeductions.add(totalDeductions);
      batchTotalNet = batchTotalNet.add(netPayable);
      batchTotalEmpPf = batchTotalEmpPf.add(emplyrPfDec);
      batchTotalEmpEsi = batchTotalEmpEsi.add(emplyrEsiDec);

      calculatedItems.push({
        companyId,
        payrollBatchId: batch.id,
        employeeProfileId: emp.id,
        workingDays: new Decimal(calendarDays),
        paidDays: paidDaysDec,
        lopDays: lopDaysDec,
        overtimeHours: new Decimal(att.overtimeHours || 0),
        grossEarned,
        totalDeductions,
        netPayable,
        earningsBreakdown,
        deductionsBreakdown,
        employerPf: emplyrPfDec,
        employerEsi: emplyrEsiDec,
      });
    }

    return prisma.$transaction(async (tx) => {
      // Clear previous items
      await tx.payrollItem.deleteMany({
        where: { payrollBatchId: batch.id },
      });

      // Insert fresh calculated items
      for (const item of calculatedItems) {
        await tx.payrollItem.create({ data: item });
      }

      // Update batch header
      const updated = await tx.payrollBatch.update({
        where: { id: batch.id },
        data: {
          totalEmployees: calculatedItems.length,
          totalGross: batchTotalGross,
          totalDeductions: batchTotalDeductions,
          totalNet: batchTotalNet,
          totalEmployerPf: batchTotalEmpPf,
          totalEmployerEsi: batchTotalEmpEsi,
          status: 'CALCULATED',
          processedById: String(actor.userId || actor.id || 'admin'),
          processedAt: new Date(),
        },
        include: { items: true },
      });

      await auditService.logAction({
        companyId,
        actor,
        action: 'CALCULATE_PAYROLL_BATCH',
        entityType: 'PAYROLL_BATCH',
        entityId: batch.id,
        details: {
          totalEmployees: calculatedItems.length,
          totalGross: batchTotalGross.toNumber(),
          totalNet: batchTotalNet.toNumber(),
        },
        reason: `Calculated payroll for ${calculatedItems.length} employees`,
      });

      return updated;
    });
  },

  // =========================================================================
  // 3. SUBMIT FOR APPROVAL & MAKER-CHECKER APPROVAL
  // =========================================================================

  async submitForApproval(companyId, batchId, actor = {}) {
    const batch = await prisma.payrollBatch.findFirst({
      where: { id: batchId, companyId },
    });
    if (!batch) throw payrollError('Payroll batch not found.', 404);
    if (batch.status !== 'CALCULATED') {
      throw payrollError(`Only CALCULATED payroll batches can be submitted for approval (Current: ${batch.status}).`, 409);
    }

    const appReq = await approvalService.createRequest({
      companyId,
      entityType: 'PAYROLL_BATCH',
      entityId: batch.id,
      title: `Monthly Payroll Batch ${batch.batchNumber} (${batch.month}/${batch.year})`,
      summary: `Total Gross: ₹${Number(batch.totalGross).toFixed(2)}, Total Net: ₹${Number(batch.totalNet).toFixed(2)}, Employees: ${batch.totalEmployees}`,
      amount: Number(batch.totalNet),
      creatorId: actor.userId || actor.id,
      creatorName: actor.name || 'Payroll Officer',
      role: actor.role || 'COMPANY_ADMIN',
    });

    const updated = await prisma.payrollBatch.update({
      where: { id: batch.id },
      data: {
        status: 'PENDING_APPROVAL',
        approvalRequestId: appReq.id,
      },
    });

    return { ...updated, approvalRequestId: appReq.id };
  },

  async approveBatch(companyId, batchId, actor = {}) {
    const batch = await prisma.payrollBatch.findFirst({
      where: { id: batchId, companyId },
      include: {
        items: {
          include: { profile: true },
        },
      },
    });
    if (!batch) throw payrollError('Payroll batch not found.', 404);
    if (batch.status !== 'PENDING_APPROVAL' && batch.status !== 'CALCULATED') {
      throw payrollError(`Cannot approve payroll batch in ${batch.status} status.`, 409);
    }

    // Segregation of duties: Processor cannot be approver if both user IDs are present
    const actorId = String(actor.userId || actor.id || '');
    if (batch.processedById && actorId && batch.processedById === actorId) {
      // Maker-checker guard
      throw payrollError('Segregation of Duties Violation: You cannot approve a payroll batch you processed.', 403);
    }

    return prisma.$transaction(async (tx) => {
      // Update batch to APPROVED
      const updated = await tx.payrollBatch.update({
        where: { id: batch.id },
        data: { status: 'APPROVED' },
      });

      // Automatically generate EmployeePayslip snapshots for all items
      for (const item of batch.items) {
        const payslipNumber = `PS-${batch.year}${String(batch.month).padStart(2, '0')}-${item.profile.employeeCode}`;
        const downloadToken = generateSecureToken(32);

        const snapshotJson = {
          batchNumber: batch.batchNumber,
          month: batch.month,
          year: batch.year,
          employee: {
            id: item.profile.id,
            employeeCode: item.profile.employeeCode,
            displayName: item.profile.displayName,
            panMasked: item.profile.panMasked,
            bankName: item.profile.bankName,
            bankAccountMasked: item.profile.bankAccountMasked,
            bankIfsc: item.profile.bankIfsc,
            uanNumber: item.profile.uanNumber,
            esicNumber: item.profile.esicNumber,
          },
          workingDays: item.workingDays,
          paidDays: item.paidDays,
          lopDays: item.lopDays,
          earningsBreakdown: item.earningsBreakdown,
          deductionsBreakdown: item.deductionsBreakdown,
          grossEarned: item.grossEarned,
          totalDeductions: item.totalDeductions,
          netPayable: item.netPayable,
          employerPf: item.employerPf,
          employerEsi: item.employerEsi,
        };

        await tx.employeePayslip.upsert({
          where: { payrollItemId: item.id },
          create: {
            companyId,
            payrollItemId: item.id,
            employeeProfileId: item.employeeProfileId,
            payslipNumber,
            month: batch.month,
            year: batch.year,
            grossAmount: item.grossEarned,
            deductionsAmount: item.totalDeductions,
            netAmount: item.netPayable,
            snapshotJson,
            downloadToken,
            isPublished: true,
            publishedAt: new Date(),
          },
          update: {
            snapshotJson,
            grossAmount: item.grossEarned,
            deductionsAmount: item.totalDeductions,
            netAmount: item.netPayable,
            isPublished: true,
          },
        });
      }

      await auditService.logAction({
        companyId,
        actor,
        action: 'APPROVE_PAYROLL_BATCH',
        entityType: 'PAYROLL_BATCH',
        entityId: batch.id,
        afterState: { status: 'APPROVED' },
        reason: `Approved payroll batch ${batch.batchNumber}`,
      });

      return updated;
    });
  },

  // =========================================================================
  // 4. GENERAL LEDGER INTEGRATION (BALANCED DOUBLE-ENTRY POSTING)
  // =========================================================================

  async postToGeneralLedger(companyId, batchId, actor = {}) {
    const batch = await prisma.payrollBatch.findFirst({
      where: { id: batchId, companyId },
      include: { items: true },
    });
    if (!batch) throw payrollError('Payroll batch not found.', 404);
    if (batch.status !== 'APPROVED') {
      throw payrollError(`Only APPROVED payroll batches can be posted to General Ledger (Current: ${batch.status}).`, 409);
    }
    if (batch.voucherId) {
      throw payrollError('This payroll batch has already been posted to General Ledger.', 409);
    }

    // 1. Provision / Resolve standard accounts
    const salaryExpAcc = await standardAccountsService.ensureStandardAccount(companyId, 'SALARY_EXPENSE');
    const empPfExpAcc = await standardAccountsService.ensureStandardAccount(companyId, 'EMPLOYER_PF_EXPENSE');
    const empEsiExpAcc = await standardAccountsService.ensureStandardAccount(companyId, 'EMPLOYER_ESIC_EXPENSE');

    const pfPayableAcc = await standardAccountsService.ensureStandardAccount(companyId, 'EMPLOYEE_PF_PAYABLE');
    const esiPayableAcc = await standardAccountsService.ensureStandardAccount(companyId, 'EMPLOYEE_ESIC_PAYABLE');
    const ptPayableAcc = await standardAccountsService.ensureStandardAccount(companyId, 'PROFESSIONAL_TAX_PAYABLE');
    const tdsPayableAcc = await standardAccountsService.ensureStandardAccount(companyId, 'TDS_PAYABLE');
    const netSalPayableAcc = await standardAccountsService.ensureStandardAccount(companyId, 'NET_SALARY_PAYABLE');

    // 2. Aggregate breakdown
    let totalGross = new Decimal(batch.totalGross);
    let totalEmployerPf = new Decimal(batch.totalEmployerPf);
    let totalEmployerEsi = new Decimal(batch.totalEmployerEsi);

    let totalEmployeePf = new Decimal(0);
    let totalEmployeeEsi = new Decimal(0);
    let totalPt = new Decimal(0);
    let totalTds = new Decimal(0);
    let totalNet = new Decimal(batch.totalNet);

    for (const item of batch.items) {
      const deductions = Array.isArray(item.deductionsBreakdown)
        ? item.deductionsBreakdown
        : JSON.parse(item.deductionsBreakdown || '[]');

      for (const d of deductions) {
        if (d.code === 'EPF') totalEmployeePf = totalEmployeePf.add(new Decimal(d.amount || 0));
        if (d.code === 'ESIC') totalEmployeeEsi = totalEmployeeEsi.add(new Decimal(d.amount || 0));
        if (d.code === 'PT') totalPt = totalPt.add(new Decimal(d.amount || 0));
        if (d.code === 'TDS') totalTds = totalTds.add(new Decimal(d.amount || 0));
      }
    }

    // Combined liabilities
    const combinedPfLiability = totalEmployeePf.add(totalEmployerPf);
    const combinedEsiLiability = totalEmployeeEsi.add(totalEmployerEsi);

    // Total Debits = Gross + Employer PF + Employer ESIC
    const totalDebits = totalGross.add(totalEmployerPf).add(totalEmployerEsi);

    // Total Credits = Combined PF + Combined ESI + PT + TDS + Net Salary Payable
    const totalCredits = combinedPfLiability.add(combinedEsiLiability).add(totalPt).add(totalTds).add(totalNet);

    // Invariance Check: Total Dr == Total Cr
    if (!totalDebits.equals(totalCredits)) {
      throw payrollError(
        `Double-entry imbalance: Total Debits (₹${totalDebits.toFixed(2)}) does not equal Total Credits (₹${totalCredits.toFixed(2)}). Difference: ₹${totalDebits.sub(totalCredits).abs().toFixed(2)}`,
        500
      );
    }

    // 3. Construct Voucher lines
    const voucherItems = [];

    // DR: Salaries & Wages Expense
    if (totalGross.greaterThan(0)) {
      voucherItems.push({
        accountId: salaryExpAcc.id,
        debitAmount: totalGross.toNumber(),
        creditAmount: 0,
        narration: `Gross salary expense for ${batch.month}/${batch.year}`,
      });
    }

    // DR: Employer PF Contribution Expense
    if (totalEmployerPf.greaterThan(0)) {
      voucherItems.push({
        accountId: empPfExpAcc.id,
        debitAmount: totalEmployerPf.toNumber(),
        creditAmount: 0,
        narration: `Employer PF expense for ${batch.month}/${batch.year}`,
      });
    }

    // DR: Employer ESIC Contribution Expense
    if (totalEmployerEsi.greaterThan(0)) {
      voucherItems.push({
        accountId: empEsiExpAcc.id,
        debitAmount: totalEmployerEsi.toNumber(),
        creditAmount: 0,
        narration: `Employer ESIC expense for ${batch.month}/${batch.year}`,
      });
    }

    // CR: PF Payable (Employee + Employer)
    if (combinedPfLiability.greaterThan(0)) {
      voucherItems.push({
        accountId: pfPayableAcc.id,
        debitAmount: 0,
        creditAmount: combinedPfLiability.toNumber(),
        narration: `PF liability (Employee + Employer) for ${batch.month}/${batch.year}`,
      });
    }

    // CR: ESIC Payable (Employee + Employer)
    if (combinedEsiLiability.greaterThan(0)) {
      voucherItems.push({
        accountId: esiPayableAcc.id,
        debitAmount: 0,
        creditAmount: combinedEsiLiability.toNumber(),
        narration: `ESIC liability (Employee + Employer) for ${batch.month}/${batch.year}`,
      });
    }

    // CR: Professional Tax Payable
    if (totalPt.greaterThan(0)) {
      voucherItems.push({
        accountId: ptPayableAcc.id,
        debitAmount: 0,
        creditAmount: totalPt.toNumber(),
        narration: `PT payable for ${batch.month}/${batch.year}`,
      });
    }

    // CR: TDS Payable
    if (totalTds.greaterThan(0)) {
      voucherItems.push({
        accountId: tdsPayableAcc.id,
        debitAmount: 0,
        creditAmount: totalTds.toNumber(),
        narration: `TDS payable for ${batch.month}/${batch.year}`,
      });
    }

    // CR: Net Salary Payable
    if (totalNet.greaterThan(0)) {
      voucherItems.push({
        accountId: netSalPayableAcc.id,
        debitAmount: 0,
        creditAmount: totalNet.toNumber(),
        narration: `Net salary payable to employees for ${batch.month}/${batch.year}`,
      });
    }

    // 4. Create and post voucher via Phase 8 Accounting Core
    const draftVoucher = await voucherService.createDraftVoucher(
      companyId,
      {
        voucherDate: batch.periodEndDate,
        voucherType: 'JOURNAL',
        referenceType: 'PAYROLL_BATCH',
        referenceId: batch.id,
        referenceNo: batch.batchNumber,
        narration: `Monthly Payroll for ${batch.month}/${batch.year} (${batch.totalEmployees} employees)`,
        items: voucherItems,
      },
      actor
    );

    const postResult = await voucherService.postVoucher(companyId, draftVoucher.id, actor);
    const postedVoucherId = postResult.id || postResult.voucher?.id;
    const postedVoucherNo = postResult.voucherNo || postResult.voucher?.voucherNo;

    // 5. Update PayrollBatch
    const updatedBatch = await prisma.payrollBatch.update({
      where: { id: batch.id },
      data: {
        status: 'POSTED_TO_GL',
        voucherId: postedVoucherId,
        postedToGlAt: new Date(),
      },
      include: { voucher: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'POST_PAYROLL_TO_GL',
      entityType: 'PAYROLL_BATCH',
      entityId: batch.id,
      details: { voucherId: postedVoucherId, voucherNo: postedVoucherNo },
      reason: `Posted payroll batch ${batch.batchNumber} to General Ledger via Journal Voucher ${postedVoucherNo}`,
    });

    return updatedBatch;
  },

  // =========================================================================
  // 5. DISBURSEMENT / BANK TRANSFER EXPORT
  // =========================================================================

  async generateDisbursementCsv(companyId, batchId) {
    const batch = await prisma.payrollBatch.findFirst({
      where: { id: batchId, companyId },
      include: {
        items: {
          include: { profile: true },
        },
      },
    });
    if (!batch) throw payrollError('Payroll batch not found.', 404);

    const headers = [
      'Beneficiary Account Number',
      'IFSC Code',
      'Beneficiary Name',
      'Amount',
      'Remarks',
      'Employee Code',
    ];

    const rows = batch.items.map((item) => {
      // Use masked account or clear if decrypted, fallback to masked for safety
      const acc = item.profile.bankAccountMasked || 'NA';
      const ifsc = item.profile.bankIfsc || 'NA';
      const name = item.profile.displayName.replace(/,/g, '');
      const amount = Number(item.netPayable).toFixed(2);
      const remarks = `Salary ${batch.month}/${batch.year}`;
      const code = item.profile.employeeCode;
      return `${acc},${ifsc},"${name}",${amount},"${remarks}",${code}`;
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    return {
      batchNumber: batch.batchNumber,
      month: batch.month,
      year: batch.year,
      totalNet: batch.totalNet,
      employeeCount: batch.items.length,
      csvContent,
    };
  },

  async markAsDisbursed(companyId, batchId, actor = {}) {
    const batch = await prisma.payrollBatch.findFirst({
      where: { id: batchId, companyId },
    });
    if (!batch) throw payrollError('Payroll batch not found.', 404);
    if (batch.status !== 'POSTED_TO_GL' && batch.status !== 'APPROVED') {
      throw payrollError(`Cannot disburse payroll in ${batch.status} status.`, 409);
    }

    const updated = await prisma.payrollBatch.update({
      where: { id: batch.id },
      data: {
        status: 'PAID',
        disbursedAt: new Date(),
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'DISBURSE_PAYROLL',
      entityType: 'PAYROLL_BATCH',
      entityId: batch.id,
      afterState: { status: 'PAID' },
      reason: `Marked payroll batch ${batch.batchNumber} as disbursed/paid`,
    });

    return updated;
  },

  async listBatches(companyId, filters = {}) {
    const { year, status } = filters;
    const where = { companyId };
    if (year) where.year = Number(year);
    if (status) where.status = status;

    return prisma.payrollBatch.findMany({
      where,
      include: {
        voucher: { select: { id: true, voucherNo: true, status: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  },

  async getBatchById(companyId, batchId) {
    const batch = await prisma.payrollBatch.findFirst({
      where: { id: batchId, companyId },
      include: {
        voucher: true,
        items: {
          include: {
            profile: {
              select: { id: true, employeeCode: true, displayName: true, department: true, designation: true },
            },
            payslip: { select: { id: true, payslipNumber: true, downloadToken: true } },
          },
        },
      },
    });
    if (!batch) throw payrollError('Payroll batch not found.', 404);
    return batch;
  },
};

export default payrollService;
