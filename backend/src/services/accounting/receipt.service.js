import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';
import voucherService from './voucher.service.js';
import standardAccountsService from './standardAccounts.service.js';
import auditService from '../audit.service.js';

const Decimal = Prisma.Decimal;

function receiptError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export const receiptService = {
  // =========================================================================
  // 1. CREATE CUSTOMER RECEIPT
  // =========================================================================

  async createReceipt(companyId, data, actor = {}) {
    const {
      paymentReceiptNo,
      customerId,
      paymentMode = 'BANK',
      amount,
      paymentDate = new Date(),
      bankAccountId,
      chequeOrReferenceNo,
      chequeDate,
      isAdvance = false,
      notes,
    } = data;

    if (!customerId) {
      throw receiptError('customerId is required to record a Customer Receipt.');
    }

    const receiptAmount = new Decimal(amount || 0);
    if (receiptAmount.lessThanOrEqualTo(0)) {
      throw receiptError('Receipt amount must be greater than zero.');
    }

    // Verify Customer
    const customer = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer) {
      throw receiptError(`Customer not found with id ${customerId}.`, 404);
    }

    // Verify BankAccount if provided
    if (bankAccountId) {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, companyId },
      });
      if (!bankAccount) {
        throw receiptError(`Bank Account not found with id ${bankAccountId}.`, 404);
      }
    }

    const validModes = ['CASH', 'BANK', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'];
    const modeUpper = paymentMode.toUpperCase();
    if (!validModes.includes(modeUpper)) {
      throw receiptError(`Invalid paymentMode: ${paymentMode}. Valid options are ${validModes.join(', ')}.`);
    }

    // Auto-generate receipt number if missing
    const resolvedReceiptNo = paymentReceiptNo
      ? paymentReceiptNo.trim().toUpperCase()
      : `RCT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const existing = await prisma.paymentReceipt.findFirst({
      where: { companyId, paymentReceiptNo: resolvedReceiptNo },
    });
    if (existing) {
      throw receiptError(`Receipt with number '${resolvedReceiptNo}' already exists.`);
    }

    const pDate = new Date(paymentDate);

    // Resolve FY and Period
    const fy = await prisma.financialYear.findFirst({
      where: { companyId, startDate: { lte: pDate }, endDate: { gte: pDate } },
    });
    const period = fy
      ? await prisma.accountingPeriod.findFirst({
          where: { companyId, financialYearId: fy.id, startDate: { lte: pDate }, endDate: { gte: pDate } },
        })
      : null;

    // Resolve Ledger Accounts:
    // Debit Head: Bank or Cash
    let debitAccount;
    if (modeUpper === 'CASH') {
      debitAccount = await standardAccountsService.ensureStandardAccount(companyId, 'CASH');
    } else {
      debitAccount = await standardAccountsService.ensureStandardAccount(companyId, 'BANK');
    }

    // Credit Head:
    // If advance receipt -> Credit Customer Advances liability head
    // If regular receipt -> Credit Sundry Debtors control account with customerId
    let creditAccount;
    let creditNarration;
    if (isAdvance) {
      creditAccount = await standardAccountsService.ensureStandardAccount(companyId, 'CUSTOMER_ADVANCES');
      creditNarration = `Advance received from ${customer.companyName || customer.tradeName}`;
    } else {
      creditAccount = await standardAccountsService.ensureStandardAccount(companyId, 'SUNDRY_DEBTORS');
      creditNarration = `Payment receipt from ${customer.companyName || customer.tradeName}`;
    }

    // Balanced Journal Voucher Lines
    const voucherItems = [
      {
        accountId: debitAccount.id,
        debitAmount: Number(receiptAmount),
        creditAmount: 0,
        narration: `Funds received via ${modeUpper} Ref: ${chequeOrReferenceNo || 'N/A'}`,
      },
      {
        accountId: creditAccount.id,
        customerId: isAdvance ? null : customerId, // Debtors requires customerId
        debitAmount: 0,
        creditAmount: Number(receiptAmount),
        narration: creditNarration,
      },
    ];

    return prisma.$transaction(async (tx) => {
      // 1. Create PaymentReceipt record with initial status POSTED and full unallocated amount
      const receipt = await tx.paymentReceipt.create({
        data: {
          companyId,
          paymentReceiptNo: resolvedReceiptNo,
          paymentType: isAdvance ? 'ADVANCE' : 'RECEIPT',
          customerId,
          paymentMode: modeUpper,
          amount: receiptAmount,
          unallocatedAmount: receiptAmount,
          paymentDate: pDate,
          bankAccountId: bankAccountId || null,
          chequeOrReferenceNo: chequeOrReferenceNo || null,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          financialYearId: fy ? fy.id : null,
          accountingPeriodId: period ? period.id : null,
          status: 'POSTED',
          notes: notes || null,
          createdById: actor.id || actor.userId || null,
        },
      });

      // 2. If it's an advance, create/link CustomerAdvance record to reuse existing schema
      if (isAdvance) {
        await tx.customerAdvance.create({
          data: {
            companyId,
            advanceNo: `CADV-${resolvedReceiptNo}`,
            customerId,
            amount: receiptAmount,
            paymentMode: modeUpper,
            bankReference: chequeOrReferenceNo || null,
            paymentDate: pDate,
            notes: notes || `Auto-created from Receipt ${resolvedReceiptNo}`,
            verificationStatus: 'VERIFIED',
            verifiedById: actor.id || actor.userId || null,
            verifiedByName: actor.name || 'Accounts Manager',
            verifiedAt: new Date(),
          },
        });
      }

      // 3. Create Draft Journal Voucher
      const draftVoucher = await voucherService.createDraftVoucher(
        companyId,
        {
          voucherDate: pDate,
          voucherType: 'RECEIPT',
          financialYearId: fy ? fy.id : null,
          accountingPeriodId: period ? period.id : null,
          referenceType: 'PAYMENT_RECEIPT',
          referenceId: receipt.id,
          referenceNo: receipt.paymentReceiptNo,
          narration: `Receipt ${receipt.paymentReceiptNo} from ${customer.companyName || customer.tradeName} for ₹${receiptAmount.toFixed(2)}`,
          items: voucherItems,
        },
        actor
      );

      // 4. Post the Voucher atomically
      const postedVoucher = await voucherService.postVoucher(companyId, draftVoucher.id, actor);

      // 5. Update receipt with voucherId
      await tx.paymentReceipt.update({
        where: { id: receipt.id },
        data: { voucherId: postedVoucher.id },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Cashier / Accountant',
        action: 'CUSTOMER_RECEIPT_POST',
        serviceCode: 'accounts_banking',
        moduleCode: 'customer_receipts',
        details: `Recorded Customer Receipt ${receipt.paymentReceiptNo} for ₹${receiptAmount.toFixed(2)} via ${modeUpper}. Posted Voucher: ${postedVoucher.voucherNo}.`,
      });

      return tx.paymentReceipt.findUnique({
        where: { id: receipt.id },
        include: {
          customer: true,
          voucher: { include: { items: { include: { account: true } } } },
          bankAccount: true,
        },
      });
    });
  },

  async getReceiptById(companyId, receiptId) {
    const receipt = await prisma.paymentReceipt.findFirst({
      where: { id: receiptId, companyId },
      include: {
        customer: true,
        vendor: true,
        bankAccount: true,
        voucher: { include: { items: { include: { account: true } } } },
        allocations: {
          where: { status: 'ACTIVE' },
          include: { invoice: true, bill: true },
        },
      },
    });

    if (!receipt) {
      throw receiptError(`Payment Receipt not found with id ${receiptId}.`, 404);
    }
    return receipt;
  },

  async listReceipts(companyId, filters = {}) {
    const {
      customerId,
      vendorId,
      paymentType,
      status,
      paymentMode,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 25,
    } = filters;

    const where = { companyId };
    if (customerId) where.customerId = customerId;
    if (vendorId) where.vendorId = vendorId;
    if (paymentType) where.paymentType = paymentType;
    if (status) where.status = status;
    if (paymentMode) where.paymentMode = paymentMode.toUpperCase();

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { paymentReceiptNo: { contains: search } },
        { chequeOrReferenceNo: { contains: search } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, receipts] = await Promise.all([
      prisma.paymentReceipt.count({ where }),
      prisma.paymentReceipt.findMany({
        where,
        skip,
        take,
        orderBy: { paymentDate: 'desc' },
        include: {
          customer: { select: { id: true, companyName: true } },
          vendor: { select: { id: true, name: true } },
          allocations: { where: { status: 'ACTIVE' }, select: { allocatedAmount: true } },
        },
      }),
    ]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
      receipts,
    };
  },
};

export default receiptService;
