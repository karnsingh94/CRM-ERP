import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function crossModuleError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export const crossModuleReportService = {
  // =========================================================================
  // 1. SALES ORDER END-TO-END FLOW TRACE
  // =========================================================================
  /**
   * Traces: SalesOrder -> ProductionOrders -> InventoryMovements -> DispatchOrders -> SalesInvoices -> PaymentAllocations
   */
  async getSalesOrderFlowTrace(companyId, salesOrderId) {
    if (!companyId || !salesOrderId) {
      throw crossModuleError('companyId and salesOrderId are required.');
    }

    const order = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, companyId },
    });
    if (!order) throw crossModuleError('Sales order not found.', 404);

    // Parallel fetch of linked stages via validated foreign keys
    const [productionOrders, dispatchOrders, salesInvoices] = await Promise.all([
      prisma.productionOrder.findMany({
        where: { companyId, salesOrderId },
        select: {
          id: true,
          orderNo: true,
          status: true,
          targetQuantity: true,
          producedQuantity: true,
          scheduledStart: true,
          scheduledEnd: true,
        },
      }),
      prisma.dispatchOrder.findMany({
        where: { companyId, salesOrderId },
        select: {
          id: true,
          dispatchNo: true,
          status: true,
          dispatchDate: true,
          totalPackages: true,
          totalDispatchedAmount: true,
        },
      }),
      prisma.salesInvoice.findMany({
        where: { companyId, salesOrderId },
        select: {
          id: true,
          invoiceNo: true,
          invoiceDate: true,
          totalAmount: true,
          paidAmount: true,
          outstandingAmount: true,
          status: true,
        },
      }),
    ]);

    // Fetch related inventory movements (CONSUMPTION / DISPATCH)
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        companyId,
        referenceType: { in: ['SALES_ORDER', 'PRODUCTION_ORDER', 'DISPATCH_ORDER'] },
        referenceId: { in: [salesOrderId, ...productionOrders.map((p) => p.id), ...dispatchOrders.map((d) => d.id)] },
      },
      select: {
        id: true,
        movementNo: true,
        movementType: true,
        sku: true,
        quantity: true,
        warehouse: true,
        createdAt: true,
      },
    });

    return {
      companyId,
      salesOrder: {
        id: order.id,
        orderNo: order.orderNo,
        orderDate: order.date,
        customerName: typeof order.customer === 'string' ? order.customer : (order.customer?.companyName || 'Walk-in'),
        totalAmount: Number(order.amount),
        status: order.status,
      },
      stages: {
        production: {
          count: productionOrders.length,
          orders: productionOrders,
        },
        inventoryMovements: {
          count: movements.length,
          movements,
        },
        dispatch: {
          count: dispatchOrders.length,
          orders: dispatchOrders.map((d) => ({
            ...d,
            totalDispatchedAmount: Number(d.totalDispatchedAmount),
          })),
        },
        invoicing: {
          count: salesInvoices.length,
          invoices: salesInvoices.map((inv) => ({
            ...inv,
            totalAmount: Number(inv.totalAmount),
            paidAmount: Number(inv.paidAmount),
            outstandingAmount: Number(inv.outstandingAmount),
          })),
        },
      },
    };
  },

  // =========================================================================
  // 2. PROCUREMENT THREE-WAY MATCHING (PO -> GRN -> BILL)
  // =========================================================================
  /**
   * Three-Way Matching: Verifies PurchaseOrder, PurchaseReceipt (GRN), and PurchaseBill
   * Detects quantity, unit price, and total amount variances.
   */
  async getPurchaseOrderFlowTrace(companyId, purchaseOrderId) {
    if (!companyId || !purchaseOrderId) {
      throw crossModuleError('companyId and purchaseOrderId are required.');
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, companyId },
      include: {
        vendor: { select: { id: true, name: true, taxId: true } },
      },
    });
    if (!po) throw crossModuleError('Purchase order not found.', 404);

    // Fetch Receipts and Bills
    const [receipts, bills] = await Promise.all([
      prisma.purchaseReceipt.findMany({
        where: { companyId, orderId: purchaseOrderId },
        select: {
          id: true,
          grnNo: true,
          receivedQty: true,
          acceptedQty: true,
          rejectedQty: true,
          shortQty: true,
          damagedQty: true,
          qcStatus: true,
          receivedAt: true,
        },
      }),
      prisma.purchaseBill.findMany({
        where: { companyId, orderId: purchaseOrderId },
        select: {
          id: true,
          billNo: true,
          vendorInvoiceNo: true,
          invoiceDate: true,
          totalAmount: true,
          status: true,
        },
      }),
    ]);

    // Calculate Three-Way Quantities
    // PO ordered quantity from items JSON or total
    let poOrderedQty = 0;
    if (Array.isArray(po.items)) {
      poOrderedQty = po.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }

    const grnReceivedQty = receipts.reduce((sum, r) => sum + (r.receivedQty || 0), 0);
    const grnAcceptedQty = receipts.reduce((sum, r) => sum + (r.acceptedQty || 0), 0);
    const grnRejectedQty = receipts.reduce((sum, r) => sum + (r.rejectedQty || 0), 0);

    const poTotalAmount = new Decimal(po.totalAmount || 0);
    const billedTotalAmount = bills.reduce((sum, b) => sum.add(new Decimal(b.totalAmount || 0)), new Decimal(0));

    // Variances
    const quantityVariance = grnAcceptedQty - poOrderedQty;
    const valueVariance = billedTotalAmount.sub(poTotalAmount);

    const hasMissingReceipt = receipts.length === 0 && po.status !== 'CANCELLED';
    const hasMissingBill = bills.length === 0 && receipts.length > 0;
    const isMatched = Math.abs(quantityVariance) === 0 && valueVariance.abs().lt(0.01) && !hasMissingBill;

    return {
      companyId,
      purchaseOrder: {
        id: po.id,
        orderNo: po.poNumber,
        orderDate: po.orderDate,
        vendorName: po.vendor?.name || 'Vendor',
        status: po.status,
        poOrderedQty,
        totalAmount: Number(poTotalAmount),
      },
      threeWayMatching: {
        isMatched,
        hasMissingReceipt,
        hasMissingBill,
        quantities: {
          orderedQty: poOrderedQty,
          receivedQty: grnReceivedQty,
          acceptedQty: grnAcceptedQty,
          rejectedQty: grnRejectedQty,
          quantityVariance,
        },
        financials: {
          poAmount: Number(poTotalAmount),
          billedAmount: Number(billedTotalAmount),
          valueVariance: Number(valueVariance),
        },
      },
      receipts,
      bills: bills.map((b) => ({
        ...b,
        totalAmount: Number(b.totalAmount),
      })),
    };
  },

  // =========================================================================
  // 3. JOB WORK FLOW TRACE
  // =========================================================================
  /**
   * Traces: JobWorkOrder -> Challans -> Receipts -> MaterialReturns -> Reconciliation
   */
  async getJobWorkFlowTrace(companyId, jobWorkOrderId) {
    if (!companyId || !jobWorkOrderId) {
      throw crossModuleError('companyId and jobWorkOrderId are required.');
    }

    const order = await prisma.jobWorkOrder.findFirst({
      where: { id: jobWorkOrderId, companyId },
      include: {
        vendor: { select: { id: true, name: true } },
        challans: {
          select: {
            id: true,
            challanNo: true,
            status: true,
            totalTaxableValue: true,
            createdAt: true,
          },
        },
        receipts: {
          select: {
            id: true,
            receiptNo: true,
            receivedQty: true,
            acceptedQty: true,
            rejectedQty: true,
            qcStatus: true,
            receivedAt: true,
          },
        },
        materialReturns: {
          select: {
            id: true,
            returnNo: true,
            quantityReturned: true,
            reason: true,
          },
        },
        reconciliations: {
          select: {
            id: true,
            reconciliationNo: true,
            plannedOutputQty: true,
            actualOutputQty: true,
            rejectedOutputQty: true,
            grossJobWorkCharges: true,
            excessWastageDebit: true,
            netPayableToVendor: true,
            settlementStatus: true,
          },
        },
      },
    });
    if (!order) throw crossModuleError('Job work order not found.', 404);

    return {
      companyId,
      order: {
        id: order.id,
        orderNo: order.orderNo,
        supplierName: order.vendor?.name,
        status: order.status,
      },
      challans: order.challans,
      receipts: order.receipts,
      materialReturns: order.materialReturns,
      reconciliations: order.reconciliations.map((r) => ({
        ...r,
        excessWastageDebit: Number(r.excessWastageDebit || 0),
        netPayableToVendor: Number(r.netPayableToVendor || 0),
      })),
    };
  },

  // =========================================================================
  // 4. SOLAR MAINTENANCE & SPARES FLOW TRACE
  // =========================================================================
  /**
   * Traces: SolarMaintenanceTicket -> Spares Details -> Inventory Movements
   */
  async getSolarMaintenanceFlowTrace(companyId, ticketId) {
    if (!companyId || !ticketId) {
      throw crossModuleError('companyId and ticketId are required.');
    }

    const ticket = await prisma.solarMaintenanceTicket.findFirst({
      where: { id: ticketId, companyId },
      include: {
        plant: { select: { id: true, name: true, code: true } },
        inverter: { select: { id: true, inverterCode: true } },
      },
    });
    if (!ticket) throw crossModuleError('Solar maintenance ticket not found.', 404);

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        companyId,
        referenceType: 'SOLAR_MAINTENANCE_TICKET',
        referenceId: ticketId,
      },
      select: {
        id: true,
        movementNo: true,
        sku: true,
        quantity: true,
        unitCost: true,
        warehouse: true,
        createdAt: true,
      },
    });

    let totalSparesCost = new Decimal(0);
    if (Array.isArray(ticket.sparePartsDetails)) {
      for (const item of ticket.sparePartsDetails) {
        totalSparesCost = totalSparesCost.add(new Decimal(item.totalCost || 0));
      }
    }

    return {
      companyId,
      ticket: {
        id: ticket.id,
        ticketNo: ticket.ticketNo,
        subject: ticket.subject,
        status: ticket.status,
        plantName: ticket.plant?.name,
        inverterCode: ticket.inverter?.inverterCode,
        technicianName: ticket.technicianName,
        totalSparesCost: Number(totalSparesCost),
      },
      sparePartsDetails: ticket.sparePartsDetails || [],
      inventoryMovements: movements.map((m) => ({
        ...m,
        unitCost: Number(m.unitCost),
      })),
    };
  },

  // =========================================================================
  // 5. PAYROLL TO GENERAL LEDGER ACCOUNTING TRACE
  // =========================================================================
  /**
   * Traces: PayrollBatch -> PayrollItems -> Posted Journal Voucher
   */
  async getPayrollAccountingFlowTrace(companyId, batchId) {
    if (!companyId || !batchId) {
      throw crossModuleError('companyId and batchId are required.');
    }

    const batch = await prisma.payrollBatch.findFirst({
      where: { id: batchId, companyId },
      include: {
        items: {
          select: {
            id: true,
            grossEarned: true,
            netPayable: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
        },
        voucher: {
          select: {
            id: true,
            voucherNo: true,
            voucherDate: true,
            totalDebit: true,
            totalCredit: true,
            status: true,
          },
        },
      },
    });
    if (!batch) throw crossModuleError('Payroll batch not found.', 404);

    return {
      companyId,
      batch: {
        id: batch.id,
        batchNo: batch.batchNumber,
        period: `${batch.month}/${batch.year}`,
        employeeCount: batch.totalEmployees,
        totalGross: Number(batch.totalGross),
        totalDeductions: Number(batch.totalDeductions),
        totalNet: Number(batch.totalNet),
        status: batch.status,
      },
      journalVoucher: batch.voucher ? {
        ...batch.voucher,
        totalDebit: Number(batch.voucher.totalDebit),
        totalCredit: Number(batch.voucher.totalCredit),
      } : null,
      isPostedToGl: batch.voucher?.status === 'POSTED',
      payrollItemsSample: batch.items.slice(0, 20).map((i) => ({
        id: i.id,
        employeeName: `${i.profile?.firstName || ''} ${i.profile?.lastName || ''}`.trim() || 'Employee',
        departmentName: i.profile?.department?.name || 'General',
        grossPay: Number(i.grossEarned),
        netPay: Number(i.netPayable),
      })),
    };
  },
};

export default crossModuleReportService;
