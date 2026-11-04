import financialStatementsService from '../services/reports/financialStatements.service.js';
import operationalReportsService from '../services/reports/operationalReports.service.js';
import executiveDashboardService from '../services/reports/executiveDashboard.service.js';
import crossModuleReportService from '../services/reports/crossModuleReport.service.js';
import { generateCSV, sanitizeCellValue } from '../utils/csvExport.util.js';
import { auditService } from '../services/audit.service.js';

function reportError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function respondError(error, res, next) {
  if (error.statusCode || error.status) {
    return res.status(error.statusCode || error.status).json({
      success: false,
      message: error.message,
      code: error.code || 'BAD_REQUEST',
    });
  }
  return next(error);
}

function validateReportQuery(query = {}) {
  const { fromDate, toDate, page, limit } = query;
  if (fromDate && isNaN(Date.parse(fromDate))) {
    throw reportError('Invalid fromDate format. Expected valid ISO date or YYYY-MM-DD.', 400);
  }
  if (toDate && isNaN(Date.parse(toDate))) {
    throw reportError('Invalid toDate format. Expected valid ISO date or YYYY-MM-DD.', 400);
  }
  if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
    throw reportError('Invalid date range: fromDate cannot be greater than toDate.', 400);
  }
  if (page !== undefined && (isNaN(Number(page)) || Number(page) < 1)) {
    throw reportError('Invalid page number. Must be an integer >= 1.', 400);
  }
  if (limit !== undefined && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 500)) {
    throw reportError('Invalid limit. Must be an integer between 1 and 500.', 400);
  }
}

export const reportsController = {
  // =========================================================================
  // 1. EXECUTIVE DASHBOARD
  // =========================================================================
  async getExecutiveKpis(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await executiveDashboardService.getExecutiveKpis(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 2. FINANCIAL STATEMENTS
  // =========================================================================
  async getGeneralLedger(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const accountId = req.params.accountId || req.query.accountId;
      if (!accountId) {
        throw reportError('accountId parameter or query is required for General Ledger.', 400);
      }
      validateReportQuery(req.query);
      const data = await financialStatementsService.getGeneralLedger(companyId, accountId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getTrialBalance(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await financialStatementsService.getTrialBalance(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getProfitAndLoss(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await financialStatementsService.getProfitAndLoss(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getBalanceSheet(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await financialStatementsService.getBalanceSheet(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getCashBook(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await financialStatementsService.getCashBook(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 3. CRM & SALES REPORTS
  // =========================================================================
  async getLeadConversion(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getLeadConversionReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getCustomerSales(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getCustomerSalesReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getQuotationConversion(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getQuotationConversionReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 4. PROCUREMENT & VENDOR REPORTS
  // =========================================================================
  async getVendorSummary(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getVendorPurchaseReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getPendingPurchaseOrders(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getPendingPurchaseOrdersReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getGrnInspection(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getGrnInspectionReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 5. INVENTORY & VALUATION REPORTS
  // =========================================================================
  async getStockAgeing(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getStockAgeingReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getStockValuation(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getStockValuationReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 6. PRODUCTION REPORTS
  // =========================================================================
  async getProductionEfficiency(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getProductionEfficiencyReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 7. JOB WORK REPORTS
  // =========================================================================
  async getJobWorkSummary(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getJobWorkSummaryReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 8. DISPATCH & LOGISTICS REPORTS
  // =========================================================================
  async getDispatchSummary(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getDispatchSummaryReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 9. HRMS & PAYROLL REPORTS
  // =========================================================================
  async getMonthlyAttendance(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getMonthlyAttendanceSummary(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getDepartmentPayroll(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getDepartmentPayrollSummary(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 10. SOLAR MONITORING REPORTS
  // =========================================================================
  async getSolarGeneration(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const plantId = req.params.plantId || req.query.plantId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getSolarGenerationReport(companyId, plantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getSolarMaintenanceCost(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      validateReportQuery(req.query);
      const data = await operationalReportsService.getSolarMaintenanceCostReport(companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 11. CROSS-MODULE FLOW TRACES
  // =========================================================================
  async getSalesOrderFlowTrace(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const salesOrderId = req.params.salesOrderId || req.query.salesOrderId;
      if (!salesOrderId) throw reportError('salesOrderId parameter is required.', 400);
      const data = await crossModuleReportService.getSalesOrderFlowTrace(companyId, salesOrderId);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getPurchaseOrderFlowTrace(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const purchaseOrderId = req.params.purchaseOrderId || req.query.purchaseOrderId;
      if (!purchaseOrderId) throw reportError('purchaseOrderId parameter is required.', 400);
      const data = await crossModuleReportService.getPurchaseOrderFlowTrace(companyId, purchaseOrderId);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getJobWorkFlowTrace(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const jobWorkOrderId = req.params.jobWorkOrderId || req.query.jobWorkOrderId;
      if (!jobWorkOrderId) throw reportError('jobWorkOrderId parameter is required.', 400);
      const data = await crossModuleReportService.getJobWorkFlowTrace(companyId, jobWorkOrderId);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getSolarMaintenanceFlowTrace(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const ticketId = req.params.ticketId || req.query.ticketId;
      if (!ticketId) throw reportError('ticketId parameter is required.', 400);
      const data = await crossModuleReportService.getSolarMaintenanceFlowTrace(companyId, ticketId);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getPayrollAccountingFlowTrace(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const batchId = req.params.batchId || req.query.batchId;
      if (!batchId) throw reportError('batchId parameter is required.', 400);
      const data = await crossModuleReportService.getPayrollAccountingFlowTrace(companyId, batchId);
      res.json({ success: true, data });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 12. RFC-4180 CSV REPORT EXPORT WITH INJECTION PROTECTION & AUDIT LOGGING
  // =========================================================================
  async exportReport(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const reportType = req.params.reportType || req.query.report || req.query.reportType;
      validateReportQuery(req.query);

      let headers = [];
      let rows = [];

      switch (reportType) {
        case 'trial-balance': {
          const report = await financialStatementsService.getTrialBalance(companyId, req.query);
          headers = [
            { key: 'accountCode', label: 'Account Code' },
            { key: 'accountName', label: 'Account Name' },
            { key: 'groupName', label: 'Account Group' },
            { key: 'category', label: 'Category' },
            { key: 'openingDebit', label: 'Opening Debit' },
            { key: 'openingCredit', label: 'Opening Credit' },
            { key: 'periodDebit', label: 'Period Debit' },
            { key: 'periodCredit', label: 'Period Credit' },
            { key: 'closingDebit', label: 'Closing Debit' },
            { key: 'closingCredit', label: 'Closing Credit' },
          ];
          rows = report.accounts || [];
          break;
        }

        case 'profit-loss': {
          const report = await financialStatementsService.getProfitAndLoss(companyId, req.query);
          headers = [
            { key: 'groupType', label: 'Type' },
            { key: 'groupName', label: 'Group' },
            { key: 'accountCode', label: 'Account Code' },
            { key: 'accountName', label: 'Account Name' },
            { key: 'amount', label: 'Amount' },
          ];
          for (const grp of report.incomeGroups || []) {
            for (const acc of grp.accounts || []) {
              rows.push({ groupType: 'INCOME', groupName: grp.groupName, ...acc });
            }
          }
          for (const grp of report.expenseGroups || []) {
            for (const acc of grp.accounts || []) {
              rows.push({ groupType: 'EXPENSE', groupName: grp.groupName, ...acc });
            }
          }
          break;
        }

        case 'balance-sheet': {
          const report = await financialStatementsService.getBalanceSheet(companyId, req.query);
          headers = [
            { key: 'category', label: 'Category' },
            { key: 'groupName', label: 'Group Name' },
            { key: 'accountCode', label: 'Account Code' },
            { key: 'accountName', label: 'Account Name' },
            { key: 'balance', label: 'Balance' },
          ];
          for (const grp of report.assets || []) {
            for (const acc of grp.accounts || []) {
              rows.push({ category: 'ASSET', groupName: grp.groupName, ...acc });
            }
          }
          for (const grp of report.liabilities || []) {
            for (const acc of grp.accounts || []) {
              rows.push({ category: 'LIABILITY', groupName: grp.groupName, ...acc });
            }
          }
          for (const grp of report.equity || []) {
            for (const acc of grp.accounts || []) {
              rows.push({ category: 'EQUITY', groupName: grp.groupName, ...acc });
            }
          }
          break;
        }

        case 'general-ledger': {
          const accountId = req.query.accountId;
          if (!accountId) throw reportError('accountId query parameter is required for general-ledger export.', 400);
          const report = await financialStatementsService.getGeneralLedger(companyId, accountId, req.query);
          headers = [
            { key: 'voucherDate', label: 'Voucher Date' },
            { key: 'voucherNo', label: 'Voucher No' },
            { key: 'voucherType', label: 'Type' },
            { key: 'narration', label: 'Narration' },
            { key: 'debitAmount', label: 'Debit' },
            { key: 'creditAmount', label: 'Credit' },
            { key: 'runningBalance', label: 'Running Balance' },
          ];
          rows = report.lines || [];
          break;
        }

        case 'cash-book': {
          const report = await financialStatementsService.getCashBook(companyId, req.query);
          headers = [
            { key: 'voucherDate', label: 'Voucher Date' },
            { key: 'voucherNo', label: 'Voucher No' },
            { key: 'voucherType', label: 'Type' },
            { key: 'narration', label: 'Narration' },
            { key: 'debitAmount', label: 'Debit' },
            { key: 'creditAmount', label: 'Credit' },
            { key: 'runningBalance', label: 'Running Balance' },
          ];
          rows = report.lines || [];
          break;
        }

        case 'lead-conversion': {
          const report = await operationalReportsService.getLeadConversionReport(companyId, req.query);
          headers = [
            { key: 'source', label: 'Source' },
            { key: 'totalLeads', label: 'Total Leads' },
            { key: 'convertedLeads', label: 'Converted Leads' },
            { key: 'lostLeads', label: 'Lost Leads' },
            { key: 'conversionRatePct', label: 'Conversion Rate (%)' },
          ];
          rows = report.bySource || [];
          break;
        }

        case 'customer-sales': {
          const report = await operationalReportsService.getCustomerSalesReport(companyId, req.query);
          headers = [
            { key: 'customerName', label: 'Customer Name' },
            { key: 'invoiceCount', label: 'Invoices' },
            { key: 'invoicedAmount', label: 'Total Invoiced' },
            { key: 'paidAmount', label: 'Paid Amount' },
            { key: 'outstandingAmount', label: 'Outstanding Amount' },
          ];
          rows = report.customers || [];
          break;
        }

        case 'quotation-conversion': {
          const report = await operationalReportsService.getQuotationConversionReport(companyId, req.query);
          headers = [
            { key: 'status', label: 'Quotation Status' },
            { key: 'count', label: 'Quotation Count' },
            { key: 'totalValue', label: 'Total Value' },
          ];
          rows = report.byStatus || [];
          break;
        }

        case 'vendor-summary': {
          const report = await operationalReportsService.getVendorPurchaseReport(companyId, req.query);
          headers = [
            { key: 'vendorName', label: 'Vendor Name' },
            { key: 'totalOrders', label: 'Total Orders' },
            { key: 'poAmount', label: 'PO Amount' },
            { key: 'billedAmount', label: 'Billed Amount' },
            { key: 'grnCount', label: 'GRNs Received' },
          ];
          rows = report.vendors || [];
          break;
        }

        case 'pending-orders': {
          const report = await operationalReportsService.getPendingPurchaseOrdersReport(companyId, req.query);
          headers = [
            { key: 'poNumber', label: 'PO Number' },
            { key: 'orderDate', label: 'Order Date' },
            { key: 'vendorName', label: 'Vendor' },
            { key: 'expectedDate', label: 'Expected Date' },
            { key: 'totalAmount', label: 'Total Amount' },
            { key: 'status', label: 'Status' },
            { key: 'daysDelayed', label: 'Days Delayed' },
          ];
          rows = report.orders || [];
          break;
        }

        case 'grn-inspection': {
          const report = await operationalReportsService.getGrnInspectionReport(companyId, req.query);
          headers = [
            { key: 'grnNo', label: 'GRN Number' },
            { key: 'poNumber', label: 'PO Number' },
            { key: 'warehouse', label: 'Warehouse' },
            { key: 'receivedQty', label: 'Received Qty' },
            { key: 'acceptedQty', label: 'Accepted Qty' },
            { key: 'rejectedQty', label: 'Rejected Qty' },
            { key: 'rejectionRatePct', label: 'Rejection Rate (%)' },
            { key: 'qcStatus', label: 'QC Status' },
          ];
          rows = report.receipts || [];
          break;
        }

        case 'stock-ageing': {
          const report = await operationalReportsService.getStockAgeingReport(companyId, req.query);
          headers = [
            { key: 'sku', label: 'SKU' },
            { key: 'name', label: 'Product Name' },
            { key: 'warehouse', label: 'Warehouse' },
            { key: 'totalQty', label: 'Total Quantity' },
            { key: 'totalValue', label: 'Total Valuation' },
            { key: 'qty0to30', label: '0-30 Days' },
            { key: 'qty31to60', label: '31-60 Days' },
            { key: 'qty61to90', label: '61-90 Days' },
            { key: 'qty90plus', label: '90+ Days' },
          ];
          rows = report.items || [];
          break;
        }

        case 'stock-valuation': {
          const report = await operationalReportsService.getStockValuationReport(companyId, req.query);
          headers = [
            { key: 'sku', label: 'SKU' },
            { key: 'name', label: 'Product Name' },
            { key: 'warehouse', label: 'Warehouse' },
            { key: 'stock', label: 'Current Stock' },
            { key: 'averageCost', label: 'Average Unit Cost' },
            { key: 'totalValuation', label: 'Total Valuation' },
          ];
          rows = report.items || [];
          break;
        }

        case 'production-efficiency': {
          const report = await operationalReportsService.getProductionEfficiencyReport(companyId, req.query);
          headers = [
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value' },
          ];
          rows = [
            { metric: 'Total DPR Reports', value: report.totalDprReports },
            { metric: 'Total Planned Quantity', value: report.totalPlanned },
            { metric: 'Total Produced Quantity', value: report.totalProduced },
            { metric: 'Total Rejected Quantity', value: report.totalRejected },
            { metric: 'Overall Efficiency (%)', value: report.overallEfficiencyPercent },
            { metric: 'Rejection Rate (%)', value: report.rejectionRatePercent },
          ];
          break;
        }

        case 'job-work-summary': {
          const report = await operationalReportsService.getJobWorkSummaryReport(companyId, req.query);
          headers = [
            { key: 'orderNo', label: 'Order Number' },
            { key: 'vendorName', label: 'Vendor' },
            { key: 'targetQuantity', label: 'Issued Qty' },
            { key: 'receivedQuantity', label: 'Received Qty' },
            { key: 'rejectedQuantity', label: 'Rejected Qty' },
            { key: 'completionRatePct', label: 'Completion (%)' },
            { key: 'status', label: 'Status' },
          ];
          rows = report.orders || [];
          break;
        }

        case 'dispatch-summary': {
          const report = await operationalReportsService.getDispatchSummaryReport(companyId, req.query);
          headers = [
            { key: 'dispatchNo', label: 'Dispatch Number' },
            { key: 'dispatchDate', label: 'Dispatch Date' },
            { key: 'customerName', label: 'Customer' },
            { key: 'totalPackages', label: 'Packages' },
            { key: 'totalDispatchedAmount', label: 'Dispatched Amount' },
            { key: 'status', label: 'Status' },
            { key: 'deliverySLA', label: 'Delivery SLA' },
          ];
          rows = report.dispatches || [];
          break;
        }

        case 'hrms-attendance': {
          const report = await operationalReportsService.getMonthlyAttendanceSummary(companyId, req.query);
          headers = [
            { key: 'departmentName', label: 'Department' },
            { key: 'totalEmployees', label: 'Employees' },
            { key: 'presentDays', label: 'Present Days' },
            { key: 'absentDays', label: 'Absent Days' },
            { key: 'leaveDays', label: 'Leave Days' },
            { key: 'attendanceRatePct', label: 'Attendance Rate (%)' },
          ];
          rows = report.byDepartment || [];
          break;
        }

        case 'hrms-payroll': {
          const report = await operationalReportsService.getDepartmentPayrollSummary(companyId, req.query);
          headers = [
            { key: 'departmentName', label: 'Department' },
            { key: 'employeeCount', label: 'Employee Count' },
            { key: 'totalGross', label: 'Total Gross Pay' },
            { key: 'totalDeductions', label: 'Total Deductions' },
            { key: 'totalNet', label: 'Total Net Pay' },
          ];
          rows = report.byDepartment || [];
          break;
        }

        case 'solar-generation': {
          const plantId = req.query.plantId;
          const report = await operationalReportsService.getSolarGenerationReport(companyId, plantId, req.query);
          headers = [
            { key: 'timestamp', label: 'Timestamp' },
            { key: 'dailyEnergyKwh', label: 'Generation (kWh)' },
            { key: 'currentPowerKw', label: 'Power (kW)' },
          ];
          rows = report.logs || [];
          break;
        }

        case 'solar-maintenance': {
          const report = await operationalReportsService.getSolarMaintenanceCostReport(companyId, req.query);
          headers = [
            { key: 'ticketNo', label: 'Ticket Number' },
            { key: 'plantName', label: 'Plant Name' },
            { key: 'category', label: 'Category' },
            { key: 'priority', label: 'Priority' },
            { key: 'technicianName', label: 'Technician' },
            { key: 'status', label: 'Status' },
            { key: 'totalSparesCost', label: 'Total Spares Cost' },
          ];
          rows = report.tickets || [];
          break;
        }

        default:
          throw reportError(`Unsupported report export type: "${reportType}".`, 400);
      }

      const csvContent = generateCSV(headers, rows, { includeBom: true });
      const safeDate = new Date().toISOString().slice(0, 10);
      const filename = `${reportType}_report_${safeDate}.csv`;

      // Mandatory Audit Logging (preserving sensitive data privacy)
      await auditService.logAction({
        companyId,
        actor: req.user,
        action: `REPORT_EXPORT_${reportType.toUpperCase().replace(/-/g, '_')}`,
        serviceCode: 'reporting',
        moduleCode: 'reports_engine',
        details: `Exported ${reportType} report as CSV. Rows: ${rows.length}. Filters applied: ${JSON.stringify(req.query || {})}`,
        req,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    } catch (err) {
      respondError(err, res, next);
    }
  },
};

export default reportsController;
