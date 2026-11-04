import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function creditNoteError(message, status = 400) {
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

export const creditNoteService = {
  // =========================================================================
  // 1. DASHBOARD & LISTING
  // =========================================================================
  async getDashboard(companyId) {
    const [
      pendingCreditNotes,
      approvedCreditNotes,
      appliedCreditNotes,
      totalsAgg,
    ] = await Promise.all([
      prisma.customerCreditNote.count({
        where: { companyId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
      }),
      prisma.customerCreditNote.count({
        where: { companyId, status: 'APPROVED' },
      }),
      prisma.customerCreditNote.count({
        where: { companyId, status: 'APPLIED' },
      }),
      prisma.customerCreditNote.aggregate({
        where: { companyId, status: { not: 'CANCELLED' } },
        _sum: {
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          totalAmount: true,
          restockingFeeAmount: true,
          netCreditAmount: true,
        },
      }),
    ]);

    return {
      pendingCreditNotes,
      approvedCreditNotes,
      appliedCreditNotes,
      totalTaxableAmount: Number(totalsAgg._sum.taxableAmount || 0),
      totalTaxReversed: Number(
        (totalsAgg._sum.cgstAmount || new Decimal(0))
          .add(totalsAgg._sum.sgstAmount || new Decimal(0))
          .add(totalsAgg._sum.igstAmount || new Decimal(0))
      ),
      totalGrossCredit: Number(totalsAgg._sum.totalAmount || 0),
      totalRestockingFee: Number(totalsAgg._sum.restockingFeeAmount || 0),
      totalNetCreditAmount: Number(totalsAgg._sum.netCreditAmount || 0),
    };
  },

  async listCreditNotes(companyId, filters = {}) {
    const { status, customerId, search, fromDate, toDate } = filters;
    const where = { companyId };

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { creditNoteNo: { contains: search } },
        { customerName: { contains: search } },
        { originalInvoiceNo: { contains: search } },
      ];
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    return prisma.customerCreditNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customerReturn: true,
        salesOrder: true,
        customer: true,
      },
    });
  },

  async getCreditNoteById(companyId, creditNoteId) {
    const creditNote = await prisma.customerCreditNote.findFirst({
      where: { id: creditNoteId, companyId },
      include: {
        customerReturn: {
          include: {
            items: true,
            inspections: true,
          },
        },
        salesOrder: true,
        customer: true,
      },
    });

    if (!creditNote) {
      throw creditNoteError(`Customer Credit Note not found with id ${creditNoteId}.`, 404);
    }

    return creditNote;
  },

  // =========================================================================
  // 2. CREDIT NOTE ISSUANCE & TAX REVERSAL
  // =========================================================================
  async createCreditNote(companyId, data, actor = {}) {
    const {
      customerReturnId,
      salesOrderId,
      customerId,
      customerName,
      customerGstin,
      originalInvoiceNo,
      originalInvoiceDate,
      restockingFeeRate = 0,
      settlementType = 'LEDGER_CREDIT',
      taxRateOverride = null,
      notes,
    } = data;

    return prisma.$transaction(async (tx) => {
      let customerReturn = null;
      let finalSalesOrderId = salesOrderId;
      let finalCustomerId = customerId;
      let finalCustomerName = customerName;
      let finalGstin = customerGstin;
      let finalInvoiceNo = originalInvoiceNo;
      let finalInvoiceDate = originalInvoiceDate ? new Date(originalInvoiceDate) : null;

      let taxableAmount = new Decimal(0);
      let totalTaxCalculated = new Decimal(0);

      if (customerReturnId) {
        // IDEMPOTENCY GUARD: Check for existing active credit note for this RMA
        const existingCn = await tx.customerCreditNote.findFirst({
          where: {
            customerReturnId,
            companyId,
            status: { not: 'CANCELLED' },
          },
        });

        if (existingCn) {
          throw creditNoteError(
            `A Credit Note (${existingCn.creditNoteNo}) has already been issued for Customer Return RMA. Duplicate credit note prevented.`
          );
        }

        customerReturn = await tx.customerReturn.findFirst({
          where: { id: customerReturnId, companyId },
          include: {
            items: true,
            dispatchOrder: {
              include: { items: true },
            },
            salesOrder: true,
          },
        });

        if (!customerReturn) {
          throw creditNoteError(`Customer Return not found for id ${customerReturnId}.`, 404);
        }

        if (['REJECTED', 'CANCELLED'].includes(customerReturn.status)) {
          throw creditNoteError(`Cannot issue Credit Note against Customer Return in ${customerReturn.status} status.`);
        }

        finalSalesOrderId = finalSalesOrderId || customerReturn.salesOrderId;
        finalCustomerId = finalCustomerId || customerReturn.customerId;
        finalCustomerName = finalCustomerName || customerReturn.customerName;

        let dispatchItems = [];
        if (customerReturn.dispatchOrder) {
          finalGstin = finalGstin || customerReturn.dispatchOrder.customerGstin;
          finalInvoiceNo = finalInvoiceNo || customerReturn.dispatchOrder.invoiceNo;
          finalInvoiceDate = finalInvoiceDate || customerReturn.dispatchOrder.invoiceDate;
          dispatchItems = customerReturn.dispatchOrder.items || [];
        }

        // REQUIREMENT 1 & 6: Check whether an actual original Tax Invoice record exists
        const hasInvoice = Boolean(finalInvoiceNo && String(finalInvoiceNo).trim().length > 0);
        if (!hasInvoice && taxRateOverride === null) {
          throw creditNoteError(
            `Original Tax Invoice is unavailable for Customer Return ${customerReturn.rmaNo}. A valid original invoice reference or explicit taxRateOverride is required to calculate statutory GST reversal.`,
            422
          );
        }

        // Calculate line-by-line taxable amount and tax reversal proportionally from original invoice records
        let accumulatedTax = new Decimal(0);

        for (const rItem of customerReturn.items) {
          const itemTaxable = rItem.returnQty.mul(rItem.unitPrice);
          taxableAmount = taxableAmount.add(itemTaxable);

          // Find actual line-item tax rate from original invoice / dispatch item records
          let lineTaxRate = null;
          if (dispatchItems.length > 0) {
            const matchedDItem = dispatchItems.find(
              (di) => di.id === rItem.dispatchOrderItemId || di.sku === rItem.sku
            );
            if (matchedDItem && matchedDItem.taxRate !== null && matchedDItem.taxRate !== undefined) {
              lineTaxRate = new Decimal(matchedDItem.taxRate);
            }
          }

          // Fallback to explicit taxRateOverride if supplied
          if (lineTaxRate === null && taxRateOverride !== null && taxRateOverride !== undefined) {
            lineTaxRate = new Decimal(taxRateOverride);
          }

          // Fallback to Sales Order item if invoice exists and line tax was specified on SO
          if (lineTaxRate === null && customerReturn.salesOrder && customerReturn.salesOrder.items) {
            let rawItems = [];
            if (Array.isArray(customerReturn.salesOrder.items)) rawItems = customerReturn.salesOrder.items;
            else {
              try { rawItems = JSON.parse(customerReturn.salesOrder.items); } catch { rawItems = []; }
            }
            const matchedSoItem = rawItems.find(
              (si) => String(si.sku || si.itemCode || si.code).trim() === rItem.sku
            );
            if (matchedSoItem && (matchedSoItem.taxRate !== undefined || matchedSoItem.gstRate !== undefined)) {
              lineTaxRate = new Decimal(matchedSoItem.taxRate || matchedSoItem.gstRate);
            }
          }

          // REQUIREMENT 5 & 6: Do not silently invent a universal 18% fallback!
          if (lineTaxRate === null) {
            throw creditNoteError(
              `Statutory GST rate unavailable for SKU ${rItem.sku} on original invoice ${finalInvoiceNo || 'N/A'}. Explicit taxRateOverride is required.`,
              422
            );
          }

          // Proportional tax amount for this returned quantity
          const lineTax = itemTaxable.mul(lineTaxRate).div(100);
          accumulatedTax = accumulatedTax.add(lineTax);
        }

        totalTaxCalculated = accumulatedTax;
      } else {
        // Standalone Credit Note without return
        if (!data.taxableAmount) {
          throw creditNoteError('taxableAmount is required when creating standalone credit note.');
        }
        if (taxRateOverride === null && !data.taxRate) {
          throw creditNoteError(
            'Statutory tax rate is required for standalone credit note. Explicit taxRateOverride must be provided.',
            422
          );
        }
        taxableAmount = new Decimal(data.taxableAmount);
        const rate = new Decimal(taxRateOverride !== null ? taxRateOverride : data.taxRate);
        totalTaxCalculated = taxableAmount.mul(rate).div(100);
      }

      if (!finalCustomerName) {
        throw creditNoteError('Customer name is required for Credit Note.');
      }

      // REQUIREMENT 4: Preserve original CGST/SGST/IGST split
      // Rajasthan company state code is '08'.
      // If customer GSTIN starts with something other than '08' -> Inter-State (IGST 100%)
      // If starts with '08' or intra-state flag -> Intra-State: CGST (50%) + SGST (50%)
      const isInterState = Boolean(
        data.isInterState || (finalGstin && finalGstin.length >= 2 && !finalGstin.startsWith('08'))
      );
      let cgstAmount = new Decimal(0);
      let sgstAmount = new Decimal(0);
      let igstAmount = new Decimal(0);

      if (isInterState) {
        igstAmount = totalTaxCalculated;
      } else {
        cgstAmount = totalTaxCalculated.div(2);
        sgstAmount = totalTaxCalculated.div(2);
      }

      const totalAmount = taxableAmount.add(totalTaxCalculated);

      // Restocking fee deduction
      const feeRate = new Decimal(restockingFeeRate || 0);
      const restockingFeeAmount = totalAmount.mul(feeRate).div(100);
      const netCreditAmount = totalAmount.sub(restockingFeeAmount);

      const creditNoteNo = documentNo('CN');

      const creditNote = await tx.customerCreditNote.create({
        data: {
          companyId,
          creditNoteNo,
          customerReturnId: customerReturn ? customerReturn.id : null,
          salesOrderId: finalSalesOrderId || null,
          customerId: finalCustomerId || null,
          customerName: finalCustomerName,
          customerGstin: finalGstin || null,
          originalInvoiceNo: finalInvoiceNo || null,
          originalInvoiceDate: finalInvoiceDate,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          totalAmount,
          restockingFeeRate: feeRate,
          restockingFeeAmount,
          netCreditAmount,
          settlementType,
          status: 'DRAFT',
          notes: notes || null,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Commercial Accountant',
        action: 'CREDIT_NOTE_CREATE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'credit_notes',
        details: `Created Customer Credit Note ${creditNoteNo} for ${finalCustomerName}. Gross: ₹${totalAmount.toFixed(2)}, Restocking Fee: ₹${restockingFeeAmount.toFixed(2)}, Net Credit: ₹${netCreditAmount.toFixed(2)}.`,
      });

      return creditNote;
    });
  },

  async approveCreditNote(companyId, creditNoteId, actor = {}) {
    return prisma.$transaction(async (tx) => {
      const creditNote = await tx.customerCreditNote.findFirst({
        where: { id: creditNoteId, companyId },
      });

      if (!creditNote) {
        throw creditNoteError(`Customer Credit Note not found with id ${creditNoteId}.`, 404);
      }

      if (creditNote.status !== 'DRAFT' && creditNote.status !== 'PENDING_APPROVAL') {
        throw creditNoteError(`Cannot approve Credit Note ${creditNote.creditNoteNo} in status ${creditNote.status}.`);
      }

      // Maker-Checker SoD Restriction
      const actorId = actor.id || actor.userId;
      if (creditNote.approvedById && creditNote.approvedById === actorId) {
        throw creditNoteError('Maker-Checker violation: Creator cannot approve their own credit note.', 403);
      }

      const updated = await tx.customerCreditNote.update({
        where: { id: creditNote.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: actorId || null,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actorId || 'system',
        actorName: actor.name || 'Finance Manager',
        action: 'CREDIT_NOTE_APPROVE',
        serviceCode: 'dispatch_returns',
        moduleCode: 'credit_notes',
        details: `Approved Customer Credit Note ${creditNote.creditNoteNo} for ₹${creditNote.netCreditAmount.toFixed(2)}.`,
      });

      return updated;
    });
  },

  async applyCreditNote(companyId, creditNoteId, data = {}, actor = {}) {
    const { settlementType } = data;

    return prisma.$transaction(async (tx) => {
      const creditNote = await tx.customerCreditNote.findFirst({
        where: { id: creditNoteId, companyId },
      });

      if (!creditNote) {
        throw creditNoteError(`Customer Credit Note not found with id ${creditNoteId}.`, 404);
      }

      if (creditNote.status !== 'APPROVED') {
        throw creditNoteError(`Cannot apply Credit Note ${creditNote.creditNoteNo} with status ${creditNote.status}. Must be APPROVED first.`);
      }

      const finalSettlement = settlementType || creditNote.settlementType;

      const updated = await tx.customerCreditNote.update({
        where: { id: creditNote.id },
        data: {
          status: 'APPLIED',
          settlementType: finalSettlement,
          appliedAt: new Date(),
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Finance Executive',
        action: 'CREDIT_NOTE_APPLY',
        serviceCode: 'dispatch_returns',
        moduleCode: 'credit_notes',
        details: `Applied Credit Note ${creditNote.creditNoteNo} via settlement ${finalSettlement}. Adjusted net credit of ₹${creditNote.netCreditAmount.toFixed(2)}.`,
      });

      return updated;
    });
  },
};

export default creditNoteService;
