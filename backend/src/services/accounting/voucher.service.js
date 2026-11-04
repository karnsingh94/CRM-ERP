import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function voucherError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function documentNo(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const timeSuffix = Date.now().toString().slice(-4);
  return `${prefix}-${year}${month}-${timeSuffix}${rand}`;
}

export const voucherService = {
  // =========================================================================
  // 1. VOUCHER CREATION & ITEM EDITING (DRAFT)
  // =========================================================================

  async createDraftVoucher(companyId, data, actor = {}) {
    const {
      voucherDate = new Date(),
      voucherType = 'JOURNAL',
      financialYearId,
      accountingPeriodId,
      referenceType,
      referenceId,
      referenceNo,
      narration,
      items = [],
    } = data;

    let normalizedType = voucherType.toUpperCase();
    if (normalizedType === 'SALES') normalizedType = 'SALES_INVOICE';
    if (normalizedType === 'PURCHASE') normalizedType = 'PURCHASE_BILL';

    const validTypes = [
      'JOURNAL', 'PAYMENT', 'RECEIPT', 'CONTRA',
      'SALES_INVOICE', 'PURCHASE_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE'
    ];
    if (!validTypes.includes(normalizedType)) {
      throw voucherError(`Invalid voucherType. Allowed: ${validTypes.join(', ')}`);
    }

    const vDate = new Date(voucherDate);
    if (isNaN(vDate.getTime())) {
      throw voucherError('Invalid voucherDate format.');
    }

    // Auto-resolve or validate Financial Year & Period
    let resolvedFyId = financialYearId;
    let resolvedPeriodId = accountingPeriodId;

    if (!resolvedFyId) {
      const activeFy = await prisma.financialYear.findFirst({
        where: {
          companyId,
          startDate: { lte: vDate },
          endDate: { gte: vDate },
        },
      });
      if (activeFy) resolvedFyId = activeFy.id;
    }

    if (resolvedFyId && !resolvedPeriodId) {
      const activePeriod = await prisma.accountingPeriod.findFirst({
        where: {
          companyId,
          financialYearId: resolvedFyId,
          startDate: { lte: vDate },
          endDate: { gte: vDate },
        },
      });
      if (activePeriod) resolvedPeriodId = activePeriod.id;
    }

    // Check if period is closed or FY is locked
    if (resolvedPeriodId) {
      const period = await prisma.accountingPeriod.findFirst({
        where: { id: resolvedPeriodId, companyId },
        include: { financialYear: true },
      });
      if (period) {
        if (period.isClosed) {
          throw voucherError(`Cannot create voucher in closed Accounting Period ${period.periodName}.`);
        }
        if (period.financialYear && period.financialYear.isLocked) {
          throw voucherError(`Cannot create voucher in locked Financial Year ${period.financialYear.name}.`);
        }
      }
    }

    const voucherNo = documentNo('JV');

    // Validate items if provided
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const preparedItems = [];

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const line = items[i];
        const valLine = await this._validateVoucherLine(companyId, line, i + 1);
        totalDebit = totalDebit.add(valLine.debitAmount);
        totalCredit = totalCredit.add(valLine.creditAmount);
        preparedItems.push(valLine);
      }
    }

    const voucher = await prisma.$transaction(async (tx) => {
      const created = await tx.journalVoucher.create({
        data: {
          companyId,
          voucherNo,
          voucherDate: vDate,
          voucherType: normalizedType,
          financialYearId: resolvedFyId || null,
          accountingPeriodId: resolvedPeriodId || null,
          referenceType: referenceType || null,
          referenceId: referenceId || null,
          referenceNo: referenceNo || null,
          narration: narration ? narration.trim() : null,
          totalDebit,
          totalCredit,
          status: 'DRAFT',
          createdById: actor.id || actor.userId || null,
          createdByName: actor.name || 'Accountant',
        },
      });

      if (preparedItems.length > 0) {
        await tx.journalVoucherItem.createMany({
          data: preparedItems.map((p) => ({
            ...p,
            voucherId: created.id,
            companyId,
          })),
        });
      }

      return tx.journalVoucher.findUnique({
        where: { id: created.id },
        include: {
          items: {
            include: { account: true, customer: true, vendor: true },
            orderBy: { sequenceNo: 'asc' },
          },
          financialYear: true,
          accountingPeriod: true,
        },
      });
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'JOURNAL_VOUCHER_CREATE',
      serviceCode: 'accounts_banking',
      moduleCode: 'general_ledger',
      details: `Created Draft Journal Voucher ${voucher.voucherNo} (${voucher.voucherType}). Total Debit: ₹${totalDebit.toFixed(2)}, Credit: ₹${totalCredit.toFixed(2)}.`,
    });

    return voucher;
  },

  async updateDraftVoucher(companyId, voucherId, data, actor = {}) {
    const existing = await prisma.journalVoucher.findFirst({
      where: { id: voucherId, companyId },
      include: { items: true },
    });

    if (!existing) {
      throw voucherError(`Journal Voucher not found with id ${voucherId}.`, 404);
    }

    if (existing.status !== 'DRAFT') {
      throw voucherError(`Voucher ${existing.voucherNo} is in ${existing.status} status and is IMMUTABLE. Only DRAFT vouchers can be modified.`);
    }

    const { voucherDate, narration, referenceType, referenceId, referenceNo, items } = data;

    return prisma.$transaction(async (tx) => {
      let totalDebit = existing.totalDebit;
      let totalCredit = existing.totalCredit;

      if (items !== undefined) {
        // Replace items
        await tx.journalVoucherItem.deleteMany({
          where: { voucherId, companyId },
        });

        totalDebit = new Decimal(0);
        totalCredit = new Decimal(0);
        const preparedItems = [];

        for (let i = 0; i < items.length; i++) {
          const valLine = await this._validateVoucherLine(companyId, items[i], i + 1, tx);
          totalDebit = totalDebit.add(valLine.debitAmount);
          totalCredit = totalCredit.add(valLine.creditAmount);
          preparedItems.push(valLine);
        }

        if (preparedItems.length > 0) {
          await tx.journalVoucherItem.createMany({
            data: preparedItems.map((p) => ({
              ...p,
              voucherId,
              companyId,
            })),
          });
        }
      }

      const updated = await tx.journalVoucher.update({
        where: { id: voucherId },
        data: {
          voucherDate: voucherDate ? new Date(voucherDate) : existing.voucherDate,
          narration: narration !== undefined ? narration : existing.narration,
          referenceType: referenceType !== undefined ? referenceType : existing.referenceType,
          referenceId: referenceId !== undefined ? referenceId : existing.referenceId,
          referenceNo: referenceNo !== undefined ? referenceNo : existing.referenceNo,
          totalDebit,
          totalCredit,
        },
        include: {
          items: {
            include: { account: true, customer: true, vendor: true },
            orderBy: { sequenceNo: 'asc' },
          },
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Accountant',
        action: 'JOURNAL_VOUCHER_UPDATE',
        serviceCode: 'accounts_banking',
        moduleCode: 'general_ledger',
        details: `Updated Draft Journal Voucher ${updated.voucherNo}.`,
      });

      return updated;
    });
  },

  // =========================================================================
  // 2. VOUCHER VALIDATION & DOUBLE-ENTRY INVARIANTS
  // =========================================================================

  async validateVoucherForPosting(companyId, voucherId) {
    const voucher = await prisma.journalVoucher.findFirst({
      where: { id: voucherId, companyId },
      include: {
        items: {
          include: { account: true },
          orderBy: { sequenceNo: 'asc' },
        },
        financialYear: true,
        accountingPeriod: true,
      },
    });

    if (!voucher) {
      throw voucherError(`Journal Voucher not found with id ${voucherId}.`, 404);
    }

    if (voucher.status !== 'DRAFT') {
      throw voucherError(`Voucher ${voucher.voucherNo} is already ${voucher.status}. Only DRAFT vouchers can be posted.`);
    }

    // RULE 1: Minimum two valid lines
    if (!voucher.items || voucher.items.length < 2) {
      throw voucherError(`Double-Entry Rule Violation: Voucher must contain at least 2 lines (Found ${voucher.items ? voucher.items.length : 0}).`);
    }

    // Check financial year and period
    if (voucher.financialYear && voucher.financialYear.isLocked) {
      throw voucherError(`Cannot post voucher: Financial Year ${voucher.financialYear.name} is locked.`);
    }
    if (voucher.accountingPeriod && voucher.accountingPeriod.isClosed) {
      throw voucherError(`Cannot post voucher: Accounting Period ${voucher.accountingPeriod.periodName} is closed.`);
    }

    let calculatedDebit = new Decimal(0);
    let calculatedCredit = new Decimal(0);

    for (let i = 0; i < voucher.items.length; i++) {
      const item = voucher.items[i];

      // RULE 12: Inactive accounts
      if (item.account.status !== 'ACTIVE') {
        throw voucherError(`Cannot post voucher: Account ${item.account.accountName} (${item.account.accountCode}) is INACTIVE.`);
      }

      const d = new Decimal(item.debitAmount || 0);
      const c = new Decimal(item.creditAmount || 0);

      // RULE 2: Exactly one positive amount per line, never both, never negative
      if (d.isNegative() || c.isNegative()) {
        throw voucherError(`Line ${i + 1}: Negative amounts are strictly forbidden in double-entry ledger lines.`);
      }
      if (d.isZero() && c.isZero()) {
        throw voucherError(`Line ${i + 1}: Line item cannot have zero for both debit and credit.`);
      }
      if (d.greaterThan(0) && c.greaterThan(0)) {
        throw voucherError(`Line ${i + 1}: Line item cannot contain both debit (₹${d}) and credit (₹${c}). Exactly one must be zero.`);
      }

      // RULE 5 & 11: Control Account subledger requirements
      if (item.account.controlType === 'SUNDRY_DEBTORS' && !item.customerId) {
        throw voucherError(`Line ${i + 1}: Account ${item.account.accountName} is a Trade Debtors control account. A valid customer reference is required to preserve subledger reconciliation.`);
      }
      if (item.account.controlType === 'SUNDRY_CREDITORS' && !item.vendorId) {
        throw voucherError(`Line ${i + 1}: Account ${item.account.accountName} is a Trade Creditors control account. A valid vendor reference is required to preserve subledger reconciliation.`);
      }

      calculatedDebit = calculatedDebit.add(d);
      calculatedCredit = calculatedCredit.add(c);
    }

    // RULE 3: Exact equation invariance (Debit == Credit)
    if (!calculatedDebit.equals(calculatedCredit)) {
      throw voucherError(
        `Unbalanced Voucher: Debit total (₹${calculatedDebit.toFixed(2)}) must exactly equal Credit total (₹${calculatedCredit.toFixed(2)}). Discrepancy: ₹${calculatedDebit.sub(calculatedCredit).abs().toFixed(2)}.`
      );
    }

    return {
      isValid: true,
      voucher,
      totalDebit: calculatedDebit,
      totalCredit: calculatedCredit,
    };
  },

  // =========================================================================
  // 3. POSTING ENGINE (ATOMIC TRANSACTION WITH BALANCE UPDATES)
  // =========================================================================

  async postVoucher(companyId, voucherId, actor = {}) {
    // 1. Run full validation
    const { voucher, totalDebit, totalCredit } = await this.validateVoucherForPosting(companyId, voucherId);

    // 2. Execute atomic database transaction with CAS concurrency guard
    return prisma.$transaction(async (tx) => {
      const postedAt = new Date();

      // Atomic conditional status update (CAS): only succeeds if currently DRAFT
      const updateResult = await tx.journalVoucher.updateMany({
        where: { id: voucherId, companyId, status: 'DRAFT' },
        data: {
          status: 'POSTED',
          totalDebit,
          totalCredit,
          postedAt,
          postedById: actor.id || actor.userId || null,
          postedByName: actor.name || 'Authorised Signatory',
        },
      });

      if (updateResult.count === 0) {
        throw voucherError(`Voucher has already transitioned away from DRAFT status. Concurrent posting prevented.`);
      }

      // Update balances on all affected AccountMaster records in deterministic accountId order (avoids deadlocks)
      const sortedItems = [...voucher.items].sort((a, b) => a.accountId.localeCompare(b.accountId));
      for (const item of sortedItems) {
        const d = new Decimal(item.debitAmount || 0);
        const c = new Decimal(item.creditAmount || 0);

        // Balance movement calculation:
        // DEBIT normal balance: currentBalance = currentBalance + debit - credit
        // CREDIT normal balance: currentBalance = currentBalance + credit - debit
        let balanceDelta = new Decimal(0);
        if (item.account.normalBalance === 'DEBIT') {
          balanceDelta = d.sub(c);
        } else {
          balanceDelta = c.sub(d);
        }

        await tx.accountMaster.update({
          where: { id: item.accountId },
          data: {
            currentBalance: {
              increment: balanceDelta,
            },
          },
        });
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Authorised Signatory',
        action: 'JOURNAL_VOUCHER_POST',
        serviceCode: 'accounts_banking',
        moduleCode: 'general_ledger',
        details: `POSTED Journal Voucher ${voucher.voucherNo} (${voucher.voucherType}). Value: ₹${totalDebit.toFixed(2)}. Updated ${voucher.items.length} ledger balances.`,
      });

      return tx.journalVoucher.findUnique({
        where: { id: voucherId },
        include: {
          items: {
            include: { account: true, customer: true, vendor: true },
            orderBy: { sequenceNo: 'asc' },
          },
        },
      });
    });
  },

  // =========================================================================
  // 4. CANCELLATION & REVERSAL ENGINE
  // =========================================================================

  async cancelDraftVoucher(companyId, voucherId, reason, actor = {}) {
    const voucher = await prisma.journalVoucher.findFirst({
      where: { id: voucherId, companyId },
    });

    if (!voucher) {
      throw voucherError(`Journal Voucher not found with id ${voucherId}.`, 404);
    }

    if (voucher.status !== 'DRAFT') {
      throw voucherError(`Cannot cancel voucher ${voucher.voucherNo} in ${voucher.status} status. Posted vouchers must be reversed via contra entries.`);
    }

    const cancelled = await prisma.journalVoucher.update({
      where: { id: voucherId },
      data: {
        status: 'CANCELLED',
        narration: reason ? `${voucher.narration || ''} [CANCELLED: ${reason}]`.trim() : voucher.narration,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'JOURNAL_VOUCHER_CANCEL',
      serviceCode: 'accounts_banking',
      moduleCode: 'general_ledger',
      details: `Cancelled Draft Journal Voucher ${voucher.voucherNo}. Reason: ${reason || 'N/A'}.`,
    });

    return cancelled;
  },

  async reversePostedVoucher(companyId, voucherId, reason, actor = {}) {
    if (!reason || reason.trim().length < 5) {
      throw voucherError('A comprehensive reversal reason is required to reverse a posted journal voucher.');
    }

    const originalVoucher = await prisma.journalVoucher.findFirst({
      where: { id: voucherId, companyId },
      include: {
        items: {
          include: { account: true },
          orderBy: { sequenceNo: 'asc' },
        },
      },
    });

    if (!originalVoucher) {
      throw voucherError(`Journal Voucher not found with id ${voucherId}.`, 404);
    }

    if (originalVoucher.status !== 'POSTED') {
      throw voucherError(`Cannot reverse voucher ${originalVoucher.voucherNo} in ${originalVoucher.status} status. Only POSTED vouchers can be reversed.`);
    }

    if (originalVoucher.isReversal) {
      throw voucherError(`Voucher ${originalVoucher.voucherNo} is already a reversal voucher. Cannot reverse a reversal voucher.`);
    }

    const reversalVoucherNo = documentNo('REV');
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      // 1. Mark original voucher as REVERSED (CAS check: only if currently POSTED)
      const updateResult = await tx.journalVoucher.updateMany({
        where: { id: voucherId, companyId, status: 'POSTED' },
        data: {
          status: 'REVERSED',
        },
      });

      if (updateResult.count === 0) {
        throw voucherError(`Voucher has already been reversed or is not in POSTED status.`);
      }

      // 2. Create the Reversal Voucher header
      const reversalHeader = await tx.journalVoucher.create({
        data: {
          companyId,
          voucherNo: reversalVoucherNo,
          voucherDate: now,
          voucherType: originalVoucher.voucherType,
          financialYearId: originalVoucher.financialYearId,
          accountingPeriodId: originalVoucher.accountingPeriodId,
          referenceType: 'VOUCHER_REVERSAL',
          referenceId: originalVoucher.id,
          referenceNo: originalVoucher.voucherNo,
          narration: `Reversal of ${originalVoucher.voucherNo}. Reason: ${reason}`,
          totalDebit: originalVoucher.totalCredit, // inverted
          totalCredit: originalVoucher.totalDebit, // inverted
          status: 'POSTED',
          isReversal: true,
          reversalOfVoucherId: originalVoucher.id,
          postedAt: now,
          postedById: actor.id || actor.userId || null,
          postedByName: actor.name || 'Authorised Signatory',
          createdById: actor.id || actor.userId || null,
          createdByName: actor.name || 'Authorised Signatory',
        },
      });

      // 3. Create inverted lines: swap debit <-> credit
      const reversalItems = originalVoucher.items.map((item) => ({
        companyId,
        voucherId: reversalHeader.id,
        accountId: item.accountId,
        sequenceNo: item.sequenceNo,
        debitAmount: item.creditAmount, // inverted
        creditAmount: item.debitAmount, // inverted
        customerId: item.customerId,
        vendorId: item.vendorId,
        invoiceId: item.invoiceId,
        billId: item.billId,
        narration: `Reversal of line ${item.sequenceNo}: ${item.narration || ''}`.trim(),
      }));

      await tx.journalVoucherItem.createMany({
        data: reversalItems,
      });

      // 4. Update balances back in deterministic accountId order (avoids deadlocks)
      const sortedReversalItems = [...reversalItems].sort((a, b) => a.accountId.localeCompare(b.accountId));
      for (const item of sortedReversalItems) {
        const d = new Decimal(item.debitAmount || 0);
        const c = new Decimal(item.creditAmount || 0);

        let balanceDelta = new Decimal(0);
        const account = originalVoucher.items.find((i) => i.accountId === item.accountId).account;

        if (account.normalBalance === 'DEBIT') {
          balanceDelta = d.sub(c);
        } else {
          balanceDelta = c.sub(d);
        }

        await tx.accountMaster.update({
          where: { id: item.accountId },
          data: {
            currentBalance: {
              increment: balanceDelta,
            },
          },
        });
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Authorised Signatory',
        action: 'JOURNAL_VOUCHER_REVERSE',
        serviceCode: 'accounts_banking',
        moduleCode: 'general_ledger',
        details: `Reversed Journal Voucher ${originalVoucher.voucherNo} with Reversal Voucher ${reversalVoucherNo}. Reason: ${reason}`,
      });

      return tx.journalVoucher.findUnique({
        where: { id: reversalHeader.id },
        include: {
          items: {
            include: { account: true, customer: true, vendor: true },
            orderBy: { sequenceNo: 'asc' },
          },
          reversalOfVoucher: true,
        },
      });
    });
  },

  // =========================================================================
  // 5. LISTING & DETAILS
  // =========================================================================

  async listVouchers(companyId, filters = {}) {
    const { voucherType, status, fromDate, toDate, search, accountId } = filters;
    const where = { companyId };

    if (voucherType) where.voucherType = voucherType.toUpperCase();
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.voucherDate = {};
      if (fromDate) where.voucherDate.gte = new Date(fromDate);
      if (toDate) where.voucherDate.lte = new Date(toDate);
    }
    if (accountId) {
      where.items = { some: { accountId } };
    }
    if (search) {
      where.OR = [
        { voucherNo: { contains: search } },
        { referenceNo: { contains: search } },
        { narration: { contains: search } },
      ];
    }

    return prisma.journalVoucher.findMany({
      where,
      orderBy: { voucherDate: 'desc' },
      include: {
        items: {
          include: { account: true, customer: true, vendor: true },
          orderBy: { sequenceNo: 'asc' },
        },
        financialYear: true,
        accountingPeriod: true,
      },
    });
  },

  async getVoucherById(companyId, voucherId) {
    const voucher = await prisma.journalVoucher.findFirst({
      where: { id: voucherId, companyId },
      include: {
        items: {
          include: {
            account: { include: { group: true } },
            customer: true,
            vendor: true,
            invoice: true,
            bill: true,
          },
          orderBy: { sequenceNo: 'asc' },
        },
        financialYear: true,
        accountingPeriod: true,
        reversalOfVoucher: true,
        reversedByVouchers: true,
      },
    });

    if (!voucher) {
      throw voucherError(`Journal Voucher not found with id ${voucherId}.`, 404);
    }

    return voucher;
  },

  // =========================================================================
  // 6. INTERNAL LINE VALIDATION
  // =========================================================================

  async _validateVoucherLine(companyId, line, sequenceNo, client = prisma) {
    const {
      accountId,
      debitAmount = 0,
      creditAmount = 0,
      customerId,
      vendorId,
      invoiceId,
      billId,
      narration,
    } = line;

    if (!accountId) {
      throw voucherError(`Line ${sequenceNo}: accountId is required.`);
    }

    const account = await client.accountMaster.findFirst({
      where: { id: accountId, companyId },
    });
    if (!account) {
      throw voucherError(`Line ${sequenceNo}: Account not found with id ${accountId}.`, 404);
    }

    const debit = new Decimal(debitAmount || 0);
    const credit = new Decimal(creditAmount || 0);

    if (debit.isNegative() || credit.isNegative()) {
      throw voucherError(`Line ${sequenceNo}: Negative amounts are not allowed.`);
    }

    if (debit.greaterThan(0) && credit.greaterThan(0)) {
      throw voucherError(`Line ${sequenceNo}: A single line cannot have both positive debit (₹${debit}) and positive credit (₹${credit}).`);
    }

    if (debit.isZero() && credit.isZero()) {
      throw voucherError(`Line ${sequenceNo}: Line must specify either a debit or a credit amount.`);
    }

    // Tenant boundary checks for linked records
    if (customerId) {
      const cust = await client.crmCustomer.findFirst({
        where: { id: customerId, companyId },
      });
      if (!cust) throw voucherError(`Line ${sequenceNo}: Customer with id ${customerId} does not belong to this company.`);
    }

    if (vendorId) {
      const vend = await client.vendor.findFirst({
        where: { id: vendorId, companyId },
      });
      if (!vend) throw voucherError(`Line ${sequenceNo}: Vendor with id ${vendorId} does not belong to this company.`);
    }

    if (invoiceId) {
      const inv = await client.salesInvoice.findFirst({
        where: { id: invoiceId, companyId },
      });
      if (!inv) throw voucherError(`Line ${sequenceNo}: Sales Invoice with id ${invoiceId} does not belong to this company.`);
    }

    if (billId) {
      const bill = await client.purchaseBill.findFirst({
        where: { id: billId, companyId },
      });
      if (!bill) throw voucherError(`Line ${sequenceNo}: Purchase Bill with id ${billId} does not belong to this company.`);
    }

    return {
      accountId,
      sequenceNo,
      debitAmount: debit,
      creditAmount: credit,
      customerId: customerId || null,
      vendorId: vendorId || null,
      invoiceId: invoiceId || null,
      billId: billId || null,
      narration: narration ? narration.trim() : null,
    };
  },
};

export default voucherService;

