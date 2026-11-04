import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { standardAccountsService } from './standardAccounts.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function bankError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function maskAccountNumber(accNo) {
  if (!accNo || typeof accNo !== 'string') return '****';
  const clean = accNo.trim();
  if (clean.length <= 4) return clean;
  return 'X'.repeat(clean.length - 4) + clean.slice(-4);
}

export const bankAccountService = {
  /**
   * Create a new Bank Account for the company.
   */
  async createBankAccount(companyId, data, actor = {}) {
    if (!companyId) throw bankError('companyId is required.');

    const {
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      branchName = null,
      accountType = 'CURRENT',
      accountId = null,
      openingBalance = 0,
      overdraftLimit = 0,
      isDefault = false,
      status = 'ACTIVE',
    } = data;

    if (!bankName || !bankName.trim()) throw bankError('Bank name is required.');
    if (!accountHolderName || !accountHolderName.trim()) throw bankError('Account holder name is required.');
    if (!accountNumber || !accountNumber.trim()) throw bankError('Account number is required.');
    if (!ifscCode || !ifscCode.trim()) throw bankError('IFSC code is required.');

    const cleanAccNo = accountNumber.trim();

    // Check duplicate account number within the company
    const existing = await prisma.bankAccount.findFirst({
      where: { companyId, accountNumber: cleanAccNo },
    });
    if (existing) {
      throw bankError(`A bank account with number "${cleanAccNo}" already exists in this company.`);
    }

    // Resolve or validate linked ledger account
    let resolvedAccountId = accountId;
    if (resolvedAccountId) {
      const ledger = await prisma.accountMaster.findFirst({
        where: { id: resolvedAccountId, companyId },
        include: { accountGroup: true },
      });
      if (!ledger) {
        throw bankError('The specified ledger account does not exist or does not belong to this company.');
      }
    } else {
      // Auto-link to default BANK control/operating account
      const defaultBankLedger = await standardAccountsService.ensureStandardAccount(companyId, 'BANK');
      resolvedAccountId = defaultBankLedger.id;
    }

    const decOpening = new Decimal(openingBalance || 0);
    const decOverdraft = new Decimal(overdraftLimit || 0);

    return prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.bankAccount.updateMany({
          where: { companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const masked = maskAccountNumber(cleanAccNo);

      const created = await tx.bankAccount.create({
        data: {
          companyId,
          bankName: bankName.trim(),
          accountHolderName: accountHolderName.trim(),
          accountNumber: cleanAccNo,
          maskedAccountNumber: masked,
          ifscCode: ifscCode.trim().toUpperCase(),
          branchName: branchName ? branchName.trim() : null,
          accountType: accountType.toUpperCase(),
          accountId: resolvedAccountId,
          openingBalance: decOpening,
          currentBalance: decOpening,
          overdraftLimit: decOverdraft,
          status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          isDefault: Boolean(isDefault),
        },
        include: {
          ledgerAccount: {
            select: { id: true, accountCode: true, accountName: true, currentBalance: true },
          },
        },
      });

      try {
        await auditService.log({
          action: 'BANK_ACCOUNT_CREATED',
          entityId: created.id,
          entityType: 'BANK_ACCOUNT',
          companyId,
          userId: actor.id || actor.userId || null,
          details: { bankName: created.bankName, masked: created.maskedAccountNumber },
        });
      } catch (err) {
        // silent audit guard
      }

      return created;
    });
  },

  /**
   * Update an existing Bank Account.
   */
  async updateBankAccount(companyId, bankAccountId, data, actor = {}) {
    if (!companyId || !bankAccountId) throw bankError('companyId and bankAccountId are required.');

    const existing = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });
    if (!existing) throw bankError('Bank account not found.', 404);

    const updatePayload = {};

    if (data.bankName !== undefined) updatePayload.bankName = data.bankName.trim();
    if (data.accountHolderName !== undefined) updatePayload.accountHolderName = data.accountHolderName.trim();
    if (data.ifscCode !== undefined) updatePayload.ifscCode = data.ifscCode.trim().toUpperCase();
    if (data.branchName !== undefined) updatePayload.branchName = data.branchName ? data.branchName.trim() : null;
    if (data.accountType !== undefined) updatePayload.accountType = data.accountType.toUpperCase();
    if (data.status !== undefined) updatePayload.status = data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (data.overdraftLimit !== undefined) updatePayload.overdraftLimit = new Decimal(data.overdraftLimit || 0);

    if (data.accountNumber !== undefined) {
      const cleanAccNo = data.accountNumber.trim();
      if (cleanAccNo !== existing.accountNumber) {
        const dup = await prisma.bankAccount.findFirst({
          where: { companyId, accountNumber: cleanAccNo, id: { not: bankAccountId } },
        });
        if (dup) {
          throw bankError(`A bank account with number "${cleanAccNo}" already exists.`);
        }
        updatePayload.accountNumber = cleanAccNo;
        updatePayload.maskedAccountNumber = maskAccountNumber(cleanAccNo);
      }
    }

    if (data.accountId !== undefined && data.accountId !== existing.accountId) {
      if (data.accountId) {
        const ledger = await prisma.accountMaster.findFirst({
          where: { id: data.accountId, companyId },
        });
        if (!ledger) throw bankError('Target ledger account does not exist or does not belong to this company.');
        updatePayload.accountId = data.accountId;
      } else {
        updatePayload.accountId = null;
      }
    }

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.bankAccount.updateMany({
          where: { companyId, isDefault: true, id: { not: bankAccountId } },
          data: { isDefault: false },
        });
        updatePayload.isDefault = true;
      } else if (data.isDefault === false) {
        updatePayload.isDefault = false;
      }

      const updated = await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: updatePayload,
        include: {
          ledgerAccount: {
            select: { id: true, accountCode: true, accountName: true, currentBalance: true },
          },
        },
      });

      try {
        await auditService.log({
          action: 'BANK_ACCOUNT_UPDATED',
          entityId: updated.id,
          entityType: 'BANK_ACCOUNT',
          companyId,
          userId: actor.id || actor.userId || null,
          details: { changes: Object.keys(updatePayload) },
        });
      } catch (err) {}

      return updated;
    });
  },

  /**
   * List or search Bank Accounts.
   */
  async listBankAccounts(companyId, query = {}) {
    if (!companyId) throw bankError('companyId is required.');

    const { status, search, limit = 50, offset = 0 } = query;
    const where = { companyId };

    if (status) where.status = status.toUpperCase();
    if (search) {
      where.OR = [
        { bankName: { contains: search } },
        { accountHolderName: { contains: search } },
        { maskedAccountNumber: { contains: search } },
        { ifscCode: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.bankAccount.count({ where }),
      prisma.bankAccount.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        include: {
          ledgerAccount: {
            select: { id: true, accountCode: true, accountName: true, currentBalance: true },
          },
          _count: {
            select: {
              transactions: true,
              reconciliations: true,
            },
          },
        },
      }),
    ]);

    return { total, items };
  },

  /**
   * Get Bank Account details by ID.
   */
  async getBankAccountById(companyId, bankAccountId) {
    if (!companyId || !bankAccountId) throw bankError('companyId and bankAccountId are required.');

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      include: {
        ledgerAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            currentBalance: true,
            normalBalance: true,
          },
        },
        _count: {
          select: {
            transactions: true,
            reconciliations: true,
          },
        },
      },
    });

    if (!account) throw bankError('Bank account not found.', 404);
    return account;
  },

  /**
   * Toggle Bank Account Status.
   */
  async toggleAccountStatus(companyId, bankAccountId, status, actor = {}) {
    const validStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.updateBankAccount(companyId, bankAccountId, { status: validStatus }, actor);
  },

  /**
   * Delete Bank Account (only if no transactions or vouchers reference it).
   */
  async deleteBankAccount(companyId, bankAccountId, actor = {}) {
    if (!companyId || !bankAccountId) throw bankError('companyId and bankAccountId are required.');

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      include: {
        _count: {
          select: {
            transactions: true,
            reconciliations: true,
            paymentReceipts: true,
          },
        },
      },
    });
    if (!account) throw bankError('Bank account not found.', 404);

    if (account._count.transactions > 0) {
      throw bankError(`Cannot delete bank account: ${account._count.transactions} bank transaction(s) are associated with it.`);
    }
    if (account._count.reconciliations > 0) {
      throw bankError(`Cannot delete bank account: ${account._count.reconciliations} bank reconciliation session(s) exist for it.`);
    }
    if (account._count.paymentReceipts > 0) {
      throw bankError(`Cannot delete bank account: ${account._count.paymentReceipts} payment receipt(s) reference it.`);
    }

    await prisma.bankAccount.delete({
      where: { id: bankAccountId },
    });

    try {
      await auditService.log({
        action: 'BANK_ACCOUNT_DELETED',
        entityId: bankAccountId,
        entityType: 'BANK_ACCOUNT',
        companyId,
        userId: actor.id || actor.userId || null,
        details: { bankName: account.bankName, masked: account.maskedAccountNumber },
      });
    } catch (err) {}

    return { success: true, message: 'Bank account deleted successfully.' };
  },

  /**
   * Get ledger balance for the bank account.
   */
  async getLedgerBalance(companyId, bankAccountId) {
    const account = await this.getBankAccountById(companyId, bankAccountId);
    if (!account.accountId) {
      return { ledgerAccountId: null, ledgerBalance: new Decimal(0), normalBalance: 'DEBIT' };
    }

    const ledger = await prisma.accountMaster.findFirst({
      where: { id: account.accountId, companyId },
      select: { id: true, accountCode: true, accountName: true, currentBalance: true, normalBalance: true },
    });

    return {
      ledgerAccountId: ledger?.id || null,
      accountCode: ledger?.accountCode || null,
      accountName: ledger?.accountName || null,
      ledgerBalance: ledger ? new Decimal(ledger.currentBalance) : new Decimal(0),
      normalBalance: ledger?.normalBalance || 'DEBIT',
    };
  },

  /**
   * Get statement balance (latest running balance or current calculated balance).
   */
  async getStatementBalance(companyId, bankAccountId) {
    await this.getBankAccountById(companyId, bankAccountId);

    const latestTx = await prisma.bankTransaction.findFirst({
      where: { companyId, bankAccountId, runningBalance: { not: null } },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      select: { runningBalance: true, transactionDate: true },
    });

    if (latestTx && latestTx.runningBalance !== null) {
      return {
        statementBalance: new Decimal(latestTx.runningBalance),
        asOfDate: latestTx.transactionDate,
      };
    }

    // Fallback: sum of credits minus debits plus opening balance
    const agg = await prisma.bankTransaction.aggregate({
      where: { companyId, bankAccountId },
      _sum: { creditAmount: true, debitAmount: true },
    });

    const account = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { openingBalance: true },
    });

    const open = new Decimal(account?.openingBalance || 0);
    const cr = new Decimal(agg._sum.creditAmount || 0);
    const dr = new Decimal(agg._sum.debitAmount || 0);
    const calculated = open.add(cr).sub(dr);

    return {
      statementBalance: calculated,
      asOfDate: new Date(),
    };
  },

  /**
   * Get unreconciled transaction summary for the bank account.
   */
  async getUnreconciledTransactionSummary(companyId, bankAccountId) {
    await this.getBankAccountById(companyId, bankAccountId);

    const [unreconciledBankTx, unreconciledVouchers] = await Promise.all([
      prisma.bankTransaction.aggregate({
        where: {
          companyId,
          bankAccountId,
          reconciliationStatus: 'UNRECONCILED',
        },
        _count: { id: true },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      // Unreconciled book items can also be fetched if needed
      prisma.bankReconciliationItem.findMany({
        where: { companyId, bankTransaction: { bankAccountId } },
        select: { voucherItemId: true },
      }),
    ]);

    return {
      unreconciledBankCount: unreconciledBankTx._count.id || 0,
      totalDebitAmount: new Decimal(unreconciledBankTx._sum.debitAmount || 0),
      totalCreditAmount: new Decimal(unreconciledBankTx._sum.creditAmount || 0),
    };
  },
};

export default bankAccountService;

