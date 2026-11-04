import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';
import voucherService from './voucher.service.js';
import standardAccountsService from './standardAccounts.service.js';
import auditService from '../audit.service.js';

const Decimal = Prisma.Decimal;

function invoiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export const salesInvoiceService = {
  // =========================================================================
  // 1. INVOICE CREATION & DRAFT MANAGEMENT
  // =========================================================================

  async createDraftInvoice(companyId, data, actor = {}) {
    const {
      invoiceNo,
      invoiceDate = new Date(),
      dueDate,
      customerId,
      salesOrderId,
      dispatchOrderId,
      isInterState,
      notes,
      items = [],
      otherCharges = 0,
      discountAmount = 0,
    } = data;

    if (!customerId) {
      throw invoiceError('customerId is required to create a Sales Invoice.');
    }

    // Verify Customer belongs to company
    const customer = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer) {
      throw invoiceError(`Customer not found with id ${customerId}.`, 404);
    }

    // Auto-generate invoice number if not provided
    const resolvedInvoiceNo = invoiceNo
      ? invoiceNo.trim().toUpperCase()
      : `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Check uniqueness
    const existing = await prisma.salesInvoice.findFirst({
      where: { companyId, invoiceNo: resolvedInvoiceNo },
    });
    if (existing) {
      throw invoiceError(`Invoice with number '${resolvedInvoiceNo}' already exists for this company.`);
    }

    // Verify SalesOrder and DispatchOrder if supplied
    if (salesOrderId) {
      const so = await prisma.salesOrder.findFirst({
        where: { id: salesOrderId, companyId },
      });
      if (!so) throw invoiceError(`Sales Order with id ${salesOrderId} not found for this company.`, 404);
      if (so.customerId && so.customerId !== customerId) {
        throw invoiceError(`Customer mismatch: Sales Order belongs to customer ${so.customerId}, not ${customerId}.`, 422);
      }
    }

    let linkedDispatch = null;
    if (dispatchOrderId) {
      linkedDispatch = await prisma.dispatchOrder.findFirst({
        where: { id: dispatchOrderId, companyId },
        include: { items: true },
      });
      if (!linkedDispatch) throw invoiceError(`Dispatch Order with id ${dispatchOrderId} not found for this company.`, 404);

      // Customer ownership validation
      if (linkedDispatch.customerId && linkedDispatch.customerId !== customerId) {
        throw invoiceError(
          `Customer mismatch: Dispatch Order belongs to customer ${linkedDispatch.customerId}, but invoice customer is ${customerId}.`,
          422
        );
      }

      // SalesOrder ownership validation
      if (salesOrderId && linkedDispatch.salesOrderId && linkedDispatch.salesOrderId !== salesOrderId) {
        throw invoiceError(
          `Sales Order mismatch: Dispatch Order is linked to Sales Order ${linkedDispatch.salesOrderId}, not ${salesOrderId}.`,
          422
        );
      }

      // Conflicting invoice number check
      if (linkedDispatch.invoiceNo && linkedDispatch.invoiceNo !== resolvedInvoiceNo) {
        throw invoiceError(
          `Dispatch Order ${linkedDispatch.dispatchNo} already has a linked invoice (${linkedDispatch.invoiceNo}). Conflicting invoice number '${resolvedInvoiceNo}' cannot overwrite existing reference.`,
          409
        );
      }

      // Accidental duplicate invoice prevention for same dispatch order
      const existingForDispatch = await prisma.salesInvoice.findFirst({
        where: {
          companyId,
          dispatchOrderId,
          status: { not: 'CANCELLED' },
        },
      });
      if (existingForDispatch) {
        throw invoiceError(
          `Dispatch Order ${linkedDispatch.dispatchNo} is already linked to active Sales Invoice ${existingForDispatch.invoiceNo}. Accidental duplicate invoices are strictly prohibited.`,
          409
        );
      }
    }

    // Determine inter-state status:
    // If explicitly provided, use it; otherwise infer from customer GSTIN
    let interState = Boolean(isInterState);
    if (isInterState === undefined && customer.gstin && customer.gstin.length >= 2) {
      // If customer state code != company state (default Rajasthan "08")
      const custStateCode = customer.gstin.slice(0, 2);
      interState = custStateCode !== '08';
    }

    // Calculate line items and totals
    const preparedItems = [];
    let taxableTotal = new Decimal(0);
    let cgstTotal = new Decimal(0);
    let sgstTotal = new Decimal(0);
    let igstTotal = new Decimal(0);
    let lineDiscountsTotal = new Decimal(0);

    // If items are empty but dispatchOrderId is provided, pull from dispatch items
    let sourceItems = items;
    if ((!sourceItems || sourceItems.length === 0) && linkedDispatch && linkedDispatch.items) {
      sourceItems = linkedDispatch.items.map((di) => ({
        dispatchOrderItemId: di.id,
        productId: di.productId,
        sku: di.sku,
        description: di.description || di.sku,
        quantity: di.dispatchedQty || di.orderedQty,
        unitPrice: di.unitPrice || 0,
        taxRate: di.taxRate !== null && di.taxRate !== undefined ? di.taxRate : null,
      }));
    }

    if (!sourceItems || sourceItems.length === 0) {
      throw invoiceError('Sales Invoice must contain at least one line item.');
    }

    for (let i = 0; i < sourceItems.length; i++) {
      const line = sourceItems[i];
      const qty = new Decimal(line.quantity || 0);
      const rate = new Decimal(line.unitPrice || 0);

      if (qty.lessThanOrEqualTo(0)) {
        throw invoiceError(`Line ${i + 1}: Quantity must be greater than zero.`);
      }
      if (rate.lessThan(0)) {
        throw invoiceError(`Line ${i + 1}: Unit price cannot be negative.`);
      }

      // STRICT GST RULE: taxRate must be explicitly specified (no silent 18% assumption)
      if (line.taxRate === null || line.taxRate === undefined || isNaN(Number(line.taxRate))) {
        throw invoiceError(
          `Line ${i + 1}: Missing taxRate for item '${line.sku || 'Unknown'}'. Tax rate cannot be assumed.`,
          422
        );
      }

      const discRate = new Decimal(line.discountRate || 0);
      const gross = qty.mul(rate);
      let discAmount = new Decimal(0);
      if (line.discountAmount !== undefined && line.discountAmount !== null) {
        discAmount = new Decimal(line.discountAmount);
      } else if (discRate.greaterThan(0)) {
        discAmount = gross.mul(discRate).div(100);
      }

      const lineTaxable = gross.sub(discAmount);
      const taxRateDec = new Decimal(line.taxRate);

      let cgst = new Decimal(0);
      let sgst = new Decimal(0);
      let igst = new Decimal(0);

      if (interState) {
        igst = lineTaxable.mul(taxRateDec).div(100);
      } else {
        const halfRate = taxRateDec.div(2);
        cgst = lineTaxable.mul(halfRate).div(100);
        sgst = lineTaxable.mul(halfRate).div(100);
      }

      const lineTotal = lineTaxable.add(cgst).add(sgst).add(igst);

      taxableTotal = taxableTotal.add(lineTaxable);
      cgstTotal = cgstTotal.add(cgst);
      sgstTotal = sgstTotal.add(sgst);
      igstTotal = igstTotal.add(igst);
      lineDiscountsTotal = lineDiscountsTotal.add(discAmount);

      preparedItems.push({
        companyId,
        productId: line.productId || null,
        dispatchOrderItemId: line.dispatchOrderItemId || null,
        sku: line.sku || 'GENERAL',
        description: line.description || null,
        hsnCode: line.hsnCode || null,
        uom: line.uom || 'PCS',
        quantity: qty,
        unitPrice: rate,
        discountRate: discRate,
        discountAmount: discAmount,
        taxableAmount: lineTaxable,
        taxRate: taxRateDec,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: lineTotal,
      });
    }

    const headerOtherCharges = new Decimal(otherCharges || 0);
    const headerDiscount = new Decimal(discountAmount || 0);
    const invoiceTotal = taxableTotal
      .add(cgstTotal)
      .add(sgstTotal)
      .add(igstTotal)
      .add(headerOtherCharges)
      .sub(headerDiscount);

    const iDate = new Date(invoiceDate);
    let dDate = dueDate ? new Date(dueDate) : null;
    if (!dDate) {
      // Default due date to 30 days from invoice date
      dDate = new Date(iDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Resolve FY and Period
    const fy = await prisma.financialYear.findFirst({
      where: { companyId, startDate: { lte: iDate }, endDate: { gte: iDate } },
    });
    const period = fy
      ? await prisma.accountingPeriod.findFirst({
          where: { companyId, financialYearId: fy.id, startDate: { lte: iDate }, endDate: { gte: iDate } },
        })
      : null;

    const createdInvoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.salesInvoice.create({
        data: {
          companyId,
          invoiceNo: resolvedInvoiceNo,
          invoiceDate: iDate,
          dueDate: dDate,
          financialYearId: fy ? fy.id : null,
          accountingPeriodId: period ? period.id : null,
          customerId,
          customerName: customer.companyName || customer.tradeName || 'Valued Customer',
          customerGstin: customer.gstin || null,
          billingAddress: customer.billingAddress || null,
          shippingAddress: customer.shippingAddress || customer.billingAddress || null,
          salesOrderId: salesOrderId || (linkedDispatch ? linkedDispatch.salesOrderId : null),
          dispatchOrderId: dispatchOrderId || null,
          isInterState: interState,
          taxableAmount: taxableTotal,
          cgstAmount: cgstTotal,
          sgstAmount: sgstTotal,
          igstAmount: igstTotal,
          discountAmount: lineDiscountsTotal.add(headerDiscount),
          otherCharges: headerOtherCharges,
          totalAmount: invoiceTotal,
          paidAmount: new Decimal(0),
          outstandingAmount: invoiceTotal,
          status: 'DRAFT',
          notes: notes || null,
        },
      });

      await tx.salesInvoiceItem.createMany({
        data: preparedItems.map((item) => ({
          ...item,
          invoiceId: inv.id,
        })),
      });

      return inv;
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'SALES_INVOICE_CREATE',
      serviceCode: 'accounts_banking',
      moduleCode: 'sales_invoicing',
      details: `Created Draft Sales Invoice ${createdInvoice.invoiceNo}. Total: ₹${invoiceTotal.toFixed(2)}.`,
    });

    return this.getInvoiceById(companyId, createdInvoice.id);
  },

  async updateDraftInvoice(companyId, invoiceId, data, actor = {}) {
    const existing = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
    });
    if (!existing) {
      throw invoiceError(`Sales Invoice not found with id ${invoiceId}.`, 404);
    }
    if (existing.status !== 'DRAFT') {
      throw invoiceError(`Invoice ${existing.invoiceNo} is in ${existing.status} status and is IMMUTABLE. Only DRAFT invoices can be edited.`);
    }

    // Cancel existing draft items and recreate if items passed
    const { items, notes, dueDate, otherCharges, discountAmount } = data;

    if (items && items.length > 0) {
      // Re-create items with new calculations
      await prisma.salesInvoiceItem.deleteMany({
        where: { invoiceId, companyId },
      });

      let taxableTotal = new Decimal(0);
      let cgstTotal = new Decimal(0);
      let sgstTotal = new Decimal(0);
      let igstTotal = new Decimal(0);
      let lineDiscountsTotal = new Decimal(0);

      const preparedItems = [];
      for (let i = 0; i < items.length; i++) {
        const line = items[i];
        const qty = new Decimal(line.quantity || 0);
        const rate = new Decimal(line.unitPrice || 0);

        if (line.taxRate === null || line.taxRate === undefined || isNaN(Number(line.taxRate))) {
          throw invoiceError(`Line ${i + 1}: Missing taxRate for item '${line.sku}'.`, 422);
        }

        const discRate = new Decimal(line.discountRate || 0);
        const gross = qty.mul(rate);
        const discAmount = line.discountAmount !== undefined ? new Decimal(line.discountAmount) : gross.mul(discRate).div(100);
        const lineTaxable = gross.sub(discAmount);
        const taxRateDec = new Decimal(line.taxRate);

        let cgst = new Decimal(0);
        let sgst = new Decimal(0);
        let igst = new Decimal(0);

        if (existing.isInterState) {
          igst = lineTaxable.mul(taxRateDec).div(100);
        } else {
          cgst = lineTaxable.mul(taxRateDec.div(2)).div(100);
          sgst = lineTaxable.mul(taxRateDec.div(2)).div(100);
        }

        const lineTotal = lineTaxable.add(cgst).add(sgst).add(igst);

        taxableTotal = taxableTotal.add(lineTaxable);
        cgstTotal = cgstTotal.add(cgst);
        sgstTotal = sgstTotal.add(sgst);
        igstTotal = igstTotal.add(igst);
        lineDiscountsTotal = lineDiscountsTotal.add(discAmount);

        preparedItems.push({
          companyId,
          invoiceId,
          productId: line.productId || null,
          dispatchOrderItemId: line.dispatchOrderItemId || null,
          sku: line.sku || 'GENERAL',
          description: line.description || null,
          hsnCode: line.hsnCode || null,
          uom: line.uom || 'PCS',
          quantity: qty,
          unitPrice: rate,
          discountRate: discRate,
          discountAmount: discAmount,
          taxableAmount: lineTaxable,
          taxRate: taxRateDec,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          totalAmount: lineTotal,
        });
      }

      const headerOtherCharges = otherCharges !== undefined ? new Decimal(otherCharges) : new Decimal(existing.otherCharges);
      const headerDiscount = discountAmount !== undefined ? new Decimal(discountAmount) : new Decimal(existing.discountAmount);
      const newTotal = taxableTotal.add(cgstTotal).add(sgstTotal).add(igstTotal).add(headerOtherCharges).sub(headerDiscount);

      await prisma.salesInvoiceItem.createMany({ data: preparedItems });

      await prisma.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          taxableAmount: taxableTotal,
          cgstAmount: cgstTotal,
          sgstAmount: sgstTotal,
          igstAmount: igstTotal,
          discountAmount: lineDiscountsTotal.add(headerDiscount),
          otherCharges: headerOtherCharges,
          totalAmount: newTotal,
          outstandingAmount: newTotal,
          dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
          notes: notes !== undefined ? notes : existing.notes,
        },
      });
    } else {
      await prisma.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
          notes: notes !== undefined ? notes : existing.notes,
        },
      });
    }

    return this.getInvoiceById(companyId, invoiceId);
  },

  async getInvoiceById(companyId, invoiceId) {
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        customer: true,
        salesOrder: true,
        dispatchOrder: true,
        financialYear: true,
        accountingPeriod: true,
        voucher: {
          include: {
            items: {
              include: { account: true },
            },
          },
        },
        items: {
          orderBy: { sku: 'asc' },
        },
        allocations: {
          where: { status: 'ACTIVE' },
          include: { paymentReceipt: true },
        },
        creditNotes: true,
      },
    });

    if (!invoice) {
      throw invoiceError(`Sales Invoice not found with id ${invoiceId}.`, 404);
    }
    return invoice;
  },

  async listInvoices(companyId, filters = {}) {
    const {
      customerId,
      status,
      salesOrderId,
      dispatchOrderId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 25,
    } = filters;

    const where = { companyId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (salesOrderId) where.salesOrderId = salesOrderId;
    if (dispatchOrderId) where.dispatchOrderId = dispatchOrderId;

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search } },
        { customerName: { contains: search } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, invoices] = await Promise.all([
      prisma.salesInvoice.count({ where }),
      prisma.salesInvoice.findMany({
        where,
        skip,
        take,
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: { select: { id: true, companyName: true, gstin: true } },
          allocations: { where: { status: 'ACTIVE' }, select: { allocatedAmount: true } },
        },
      }),
    ]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
      invoices,
    };
  },

  // =========================================================================
  // 2. ATOMIC POSTING & BALANCED JOURNAL GENERATION
  // =========================================================================

  async postInvoice(companyId, invoiceId, actor = {}) {
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!invoice) {
      throw invoiceError(`Sales Invoice not found with id ${invoiceId}.`, 404);
    }

    if (invoice.status !== 'DRAFT') {
      throw invoiceError(`Invoice ${invoice.invoiceNo} has already been ${invoice.status}. Only DRAFT invoices can be posted.`);
    }

    if (!invoice.items || invoice.items.length === 0) {
      throw invoiceError(`Invoice ${invoice.invoiceNo} contains no line items and cannot be posted.`);
    }

    // Provision standard accounting heads
    const debtorsAccount = await standardAccountsService.ensureStandardAccount(companyId, 'SUNDRY_DEBTORS');
    const salesAccount = await standardAccountsService.ensureStandardAccount(companyId, 'SALES_REVENUE');

    const totalInvoiceAmt = new Decimal(invoice.totalAmount);
    const taxableAmt = new Decimal(invoice.taxableAmount);
    const cgstAmt = new Decimal(invoice.cgstAmount);
    const sgstAmt = new Decimal(invoice.sgstAmount);
    const igstAmt = new Decimal(invoice.igstAmount);
    const otherChargesAmt = new Decimal(invoice.otherCharges);

    // Build balanced double-entry voucher items:
    // 1. Debit Sundry Debtors control account (with customerId)
    const voucherItems = [
      {
        accountId: debtorsAccount.id,
        customerId: invoice.customerId,
        debitAmount: Number(totalInvoiceAmt),
        creditAmount: 0,
        narration: `Sales Invoice ${invoice.invoiceNo} - ${invoice.customerName}`,
      },
      // 2. Credit Sales Revenue account
      {
        accountId: salesAccount.id,
        debitAmount: 0,
        creditAmount: Number(taxableAmt),
        narration: `Taxable revenue on Sales Invoice ${invoice.invoiceNo}`,
      },
    ];

    // 3. Tax lines (Credits to Output GST liabilities)
    if (cgstAmt.greaterThan(0)) {
      const cgstAccount = await standardAccountsService.ensureStandardAccount(companyId, 'OUTPUT_CGST');
      voucherItems.push({
        accountId: cgstAccount.id,
        debitAmount: 0,
        creditAmount: Number(cgstAmt),
        narration: `Output CGST on Invoice ${invoice.invoiceNo}`,
      });
    }

    if (sgstAmt.greaterThan(0)) {
      const sgstAccount = await standardAccountsService.ensureStandardAccount(companyId, 'OUTPUT_SGST');
      voucherItems.push({
        accountId: sgstAccount.id,
        debitAmount: 0,
        creditAmount: Number(sgstAmt),
        narration: `Output SGST on Invoice ${invoice.invoiceNo}`,
      });
    }

    if (igstAmt.greaterThan(0)) {
      const igstAccount = await standardAccountsService.ensureStandardAccount(companyId, 'OUTPUT_IGST');
      voucherItems.push({
        accountId: igstAccount.id,
        debitAmount: 0,
        creditAmount: Number(igstAmt),
        narration: `Output IGST on Invoice ${invoice.invoiceNo}`,
      });
    }

    // 4. Other Charges if any
    if (otherChargesAmt.greaterThan(0)) {
      // Direct income head
      voucherItems.push({
        accountId: salesAccount.id,
        debitAmount: 0,
        creditAmount: Number(otherChargesAmt),
        narration: `Other charges on Invoice ${invoice.invoiceNo}`,
      });
    }

    // Execute atomic transaction:
    // Create draft voucher -> post voucher -> update invoice status to POSTED (CAS) -> link DispatchOrder
    return prisma.$transaction(async (tx) => {
      // Atomic CAS Guard: only update if currently DRAFT
      const casResult = await tx.salesInvoice.updateMany({
        where: { id: invoiceId, companyId, status: 'DRAFT' },
        data: {
          status: 'POSTED',
          outstandingAmount: totalInvoiceAmt,
          paidAmount: new Decimal(0),
        },
      });

      if (casResult.count === 0) {
        throw invoiceError(`Concurrent posting prevented: Invoice ${invoice.invoiceNo} is no longer in DRAFT status.`);
      }

      // Create draft voucher directly in transaction
      const draftVoucher = await voucherService.createDraftVoucher(
        companyId,
        {
          voucherDate: invoice.invoiceDate,
          voucherType: 'SALES_INVOICE',
          financialYearId: invoice.financialYearId,
          accountingPeriodId: invoice.accountingPeriodId,
          referenceType: 'SALES_INVOICE',
          referenceId: invoice.id,
          referenceNo: invoice.invoiceNo,
          narration: `Sales Invoice ${invoice.invoiceNo} dated ${invoice.invoiceDate.toISOString().split('T')[0]} for ${invoice.customerName}`,
          items: voucherItems,
        },
        actor
      );

      // Post the journal voucher
      const postedVoucher = await voucherService.postVoucher(companyId, draftVoucher.id, actor);

      // Link voucher to invoice
      await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          voucherId: postedVoucher.id,
        },
      });

      // Synchronize with DispatchOrder if present to preserve Phase 7 authoritative invoice link
      if (invoice.dispatchOrderId) {
        await tx.dispatchOrder.updateMany({
          where: { id: invoice.dispatchOrderId, companyId },
          data: {
            invoiceNo: invoice.invoiceNo,
            invoiceDate: invoice.invoiceDate,
          },
        });
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Authorised Signatory',
        action: 'SALES_INVOICE_POST',
        serviceCode: 'accounts_banking',
        moduleCode: 'sales_invoicing',
        details: `POSTED Sales Invoice ${invoice.invoiceNo}. Value: ₹${totalInvoiceAmt.toFixed(2)}. Linked Journal Voucher: ${postedVoucher.voucherNo}.`,
      });

      return tx.salesInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          voucher: { include: { items: { include: { account: true } } } },
          items: true,
        },
      });
    });
  },

  async cancelInvoice(companyId, invoiceId, reason, actor = {}) {
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
    });
    if (!invoice) throw invoiceError(`Sales Invoice not found with id ${invoiceId}.`, 404);

    if (invoice.status !== 'DRAFT') {
      throw invoiceError(`Cannot cancel invoice ${invoice.invoiceNo}: Only DRAFT invoices can be cancelled directly. Posted invoices require a credit note or voucher reversal.`);
    }

    const cancelled = await prisma.salesInvoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED', notes: reason ? `Cancelled: ${reason}` : 'Cancelled' },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'SALES_INVOICE_CANCEL',
      serviceCode: 'accounts_banking',
      moduleCode: 'sales_invoicing',
      details: `Cancelled draft Sales Invoice ${invoice.invoiceNo}. Reason: ${reason || 'Not specified'}.`,
    });

    return cancelled;
  },
};

export default salesInvoiceService;
