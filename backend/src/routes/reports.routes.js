import { Router } from 'express';
import prisma from '../config/prisma.js';
import { requireAuth, validateCompanyAccess } from '../middlewares/auth.middleware.js';
import reportsController from '../controllers/reports.controller.js';

const router = Router();

// ============================================================================
// PERMISSION GUARDS
// ============================================================================

async function fetchEmployeePermissions(req) {
  if (req.user?.permissions && typeof req.user.permissions === 'object') {
    return req.user.permissions;
  }
  const employeeId = req.user?.userId || req.user?.id;
  if (!employeeId || !req.user?.companyId) return {};
  try {
    const employee = await prisma.companyEmployee.findFirst({
      where: {
        id: String(employeeId),
        companyId: String(req.user.companyId),
        status: 'ACTIVE',
      },
      select: { permissions: true, accessRole: true },
    });
    return employee?.permissions || {};
  } catch {
    return {};
  }
}

export async function requireFinancialReportsAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.', code: 'UNAUTHENTICATED' });
  }
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'COMPANY_ADMIN') {
    return next();
  }

  const permissions = await fetchEmployeePermissions(req);
  const isPermitted =
    permissions.viewFinancialReports === true ||
    permissions.financial_reports === true ||
    permissions.accounting === true ||
    permissions.general_ledger === true;

  if (isPermitted) return next();

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_FINANCIAL_REPORTS',
    message: 'Access denied: Accounting or financial report privileges required.',
  });
}

export async function requirePayrollReportsAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.', code: 'UNAUTHENTICATED' });
  }
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'COMPANY_ADMIN') {
    return next();
  }

  const permissions = await fetchEmployeePermissions(req);
  const isPermitted =
    permissions.viewPayrollReports === true ||
    permissions.payroll_reports === true ||
    permissions.payroll === true;

  if (isPermitted) return next();

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_PAYROLL_REPORTS',
    message: 'Access denied: HR and Payroll report privileges required.',
  });
}

export async function requireExecutiveDashboardAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.', code: 'UNAUTHENTICATED' });
  }
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'COMPANY_ADMIN') {
    return next();
  }

  const permissions = await fetchEmployeePermissions(req);
  const isPermitted =
    permissions.viewExecutiveDashboard === true ||
    permissions.executive_dashboard === true;

  if (isPermitted) return next();

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_EXECUTIVE_DASHBOARD',
    message: 'Access denied: Executive dashboard privileges required.',
  });
}

export function requireOperationalReportsAccess(category = 'general') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.', code: 'UNAUTHENTICATED' });
    }
    if (
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'COMPANY_ADMIN' ||
      ['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER'].includes(req.user.role)
    ) {
      return next();
    }

    const permissions = await fetchEmployeePermissions(req);
    const isPermitted =
      permissions.viewReports === true ||
      permissions.operational_reports === true ||
      permissions[category] === true ||
      permissions[`${category}_reports`] === true ||
      permissions[`view_${category}_reports`] === true;

    if (isPermitted) return next();

    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_REPORT_ACCESS',
      message: `Access denied: You do not have permission to view ${category} reports.`,
    });
  };
}

export async function validateExportPermission(req, res, next) {
  const { reportType } = req.params;
  const financialTypes = ['trial-balance', 'profit-loss', 'balance-sheet', 'general-ledger', 'cash-book'];
  if (financialTypes.includes(reportType)) {
    return requireFinancialReportsAccess(req, res, next);
  }
  if (reportType === 'hrms-payroll') {
    return requirePayrollReportsAccess(req, res, next);
  }
  if (reportType === 'hrms-attendance') {
    return requireOperationalReportsAccess('hrms')(req, res, next);
  }
  return requireOperationalReportsAccess('operational')(req, res, next);
}

// ============================================================================
// BASE MIDDLEWARES
// All report routes require authentication and tenant company validation.
// ============================================================================
const base = '/companies/:companyId/reports';

router.use(base, requireAuth, validateCompanyAccess);

// 1. Executive Dashboard
router.get(`${base}/dashboard`, requireExecutiveDashboardAccess, reportsController.getExecutiveKpis);

// 2. Financial Reports
router.get(`${base}/financial/general-ledger`, requireFinancialReportsAccess, reportsController.getGeneralLedger);
router.get(`${base}/financial/general-ledger/:accountId`, requireFinancialReportsAccess, reportsController.getGeneralLedger);
router.get(`${base}/financial/trial-balance`, requireFinancialReportsAccess, reportsController.getTrialBalance);
router.get(`${base}/financial/profit-loss`, requireFinancialReportsAccess, reportsController.getProfitAndLoss);
router.get(`${base}/financial/balance-sheet`, requireFinancialReportsAccess, reportsController.getBalanceSheet);
router.get(`${base}/financial/cash-book`, requireFinancialReportsAccess, reportsController.getCashBook);

// 3. CRM & Sales Reports
router.get(`${base}/sales/lead-conversion`, requireOperationalReportsAccess('crm'), reportsController.getLeadConversion);
router.get(`${base}/sales/customer-sales`, requireOperationalReportsAccess('sales'), reportsController.getCustomerSales);
router.get(`${base}/sales/quotation-conversion`, requireOperationalReportsAccess('sales'), reportsController.getQuotationConversion);

// 4. Procurement & Purchase Reports
router.get(`${base}/purchase/vendor-summary`, requireOperationalReportsAccess('purchase'), reportsController.getVendorSummary);
router.get(`${base}/purchase/pending-orders`, requireOperationalReportsAccess('purchase'), reportsController.getPendingPurchaseOrders);
router.get(`${base}/purchase/grn-inspection`, requireOperationalReportsAccess('purchase'), reportsController.getGrnInspection);

// 5. Inventory Reports
router.get(`${base}/inventory/stock-ageing`, requireOperationalReportsAccess('inventory'), reportsController.getStockAgeing);
router.get(`${base}/inventory/stock-valuation`, requireOperationalReportsAccess('inventory'), reportsController.getStockValuation);

// 6. Production Reports
router.get(`${base}/production/efficiency`, requireOperationalReportsAccess('production'), reportsController.getProductionEfficiency);

// 7. Job Work Reports
router.get(`${base}/job-work/summary`, requireOperationalReportsAccess('job_work'), reportsController.getJobWorkSummary);

// 8. Dispatch & Logistics Reports
router.get(`${base}/dispatch/summary`, requireOperationalReportsAccess('dispatch'), reportsController.getDispatchSummary);

// 9. HRMS & Payroll Reports
router.get(`${base}/hrms/attendance`, requireOperationalReportsAccess('hrms'), reportsController.getMonthlyAttendance);
router.get(`${base}/hrms/payroll`, requirePayrollReportsAccess, reportsController.getDepartmentPayroll);

// 10. Solar Monitoring Reports
router.get(`${base}/solar/generation`, requireOperationalReportsAccess('solar'), reportsController.getSolarGeneration);
router.get(`${base}/solar/maintenance-cost`, requireOperationalReportsAccess('solar'), reportsController.getSolarMaintenanceCost);

// 11. Cross-Module Flow Traces
router.get(`${base}/cross-module/sales-flow/:salesOrderId`, requireOperationalReportsAccess('sales'), reportsController.getSalesOrderFlowTrace);
router.get(`${base}/cross-module/sales-flow`, requireOperationalReportsAccess('sales'), reportsController.getSalesOrderFlowTrace);

router.get(`${base}/cross-module/purchase-flow/:purchaseOrderId`, requireOperationalReportsAccess('purchase'), reportsController.getPurchaseOrderFlowTrace);
router.get(`${base}/cross-module/purchase-flow`, requireOperationalReportsAccess('purchase'), reportsController.getPurchaseOrderFlowTrace);

router.get(`${base}/cross-module/job-work-flow/:jobWorkOrderId`, requireOperationalReportsAccess('job_work'), reportsController.getJobWorkFlowTrace);
router.get(`${base}/cross-module/job-work-flow`, requireOperationalReportsAccess('job_work'), reportsController.getJobWorkFlowTrace);

router.get(`${base}/cross-module/solar-maintenance-flow/:ticketId`, requireOperationalReportsAccess('solar'), reportsController.getSolarMaintenanceFlowTrace);
router.get(`${base}/cross-module/solar-maintenance-flow`, requireOperationalReportsAccess('solar'), reportsController.getSolarMaintenanceFlowTrace);

router.get(`${base}/cross-module/payroll-flow/:batchId`, requirePayrollReportsAccess, reportsController.getPayrollAccountingFlowTrace);
router.get(`${base}/cross-module/payroll-flow`, requirePayrollReportsAccess, reportsController.getPayrollAccountingFlowTrace);

// 12. RFC-4180 CSV Export
router.get(`${base}/export/:reportType`, validateExportPermission, reportsController.exportReport);
router.get(`${base}/export`, validateExportPermission, reportsController.exportReport);

// Aliases for unified route compatibility
router.get(`${base}/executive/summary`, requireExecutiveDashboardAccess, reportsController.getExecutiveKpis);
router.get(`${base}/financial/profit-and-loss`, requireFinancialReportsAccess, reportsController.getProfitAndLoss);
router.get(`${base}/crm/lead-conversion`, requireOperationalReportsAccess('crm'), reportsController.getLeadConversion);
router.get(`${base}/crm/sales-pipeline`, requireOperationalReportsAccess('sales'), reportsController.getQuotationConversion);
router.get(`${base}/purchase/po-pending`, requireOperationalReportsAccess('purchase'), reportsController.getPendingPurchaseOrders);
router.get(`${base}/purchase/vendor-performance`, requireOperationalReportsAccess('purchase'), reportsController.getVendorSummary);
router.get(`${base}/purchase/three-way-matching`, requireOperationalReportsAccess('purchase'), reportsController.getPurchaseOrderFlowTrace);
router.get(`${base}/production/order-status`, requireOperationalReportsAccess('production'), reportsController.getJobWorkSummary);
router.get(`${base}/production/dpr-summary`, requireOperationalReportsAccess('production'), reportsController.getProductionEfficiency);
router.get(`${base}/job-work/material-reconciliation`, requireOperationalReportsAccess('job_work'), reportsController.getJobWorkFlowTrace);
router.get(`${base}/job-work/vendor-liability`, requireOperationalReportsAccess('job_work'), reportsController.getJobWorkSummary);
router.get(`${base}/hrms/payroll-summary`, requirePayrollReportsAccess, reportsController.getDepartmentPayroll);
router.get(`${base}/hrms/statutory-summary`, requirePayrollReportsAccess, reportsController.getDepartmentPayroll);
router.get(`${base}/solar/performance-ratio`, requireOperationalReportsAccess('solar'), reportsController.getSolarGeneration);

export default router;

