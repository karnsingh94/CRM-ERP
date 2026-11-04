import { Router } from 'express';
import multer from 'multer';
import prisma from '../config/prisma.js';
import { requireAuth, requireCompanyUser, validateCompanyAccess } from '../middlewares/auth.middleware.js';

import employeeController from '../controllers/hrms/employee.controller.js';
import kycController from '../controllers/hrms/kyc.controller.js';
import documentController from '../controllers/hrms/document.controller.js';
import shiftController from '../controllers/hrms/shift.controller.js';
import attendanceController from '../controllers/hrms/attendance.controller.js';
import leaveController from '../controllers/hrms/leave.controller.js';
import biometricController from '../controllers/hrms/biometric.controller.js';
import compensationController from '../controllers/hrms/compensation.controller.js';
import payrollController from '../controllers/hrms/payroll.controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// ============================================================================
// SECURITY & RBAC GUARDS
// ============================================================================

function requireHrManager(req, res, next) {
  const allowed = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER'];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_HR_MANAGER_REQUIRED',
      message: 'Access denied: HR Manager or Company Admin privileges required.',
    });
  }
  next();
}

async function validateEmployeeSelfService(req, res, next) {
  try {
    if (!req.user) return next();
    if (['COMPANY_ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER'].includes(req.user.role)) {
      return next();
    }

    if (req.user.role === 'EMPLOYEE') {
      const { companyId, profileId, payslipId, documentId } = req.params;

      const myProfile = await prisma.employeeProfile.findUnique({
        where: { employeeId: String(req.user.userId) },
        select: { id: true, companyId: true },
      });

      if (!myProfile) {
        return res.status(403).json({
          success: false,
          code: 'NO_LINKED_EMPLOYEE_PROFILE',
          message: 'Access denied: Your user account is not linked to an Employee Profile.',
        });
      }

      if (profileId && profileId !== myProfile.id) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_ESS_VIOLATION',
          message: 'Access denied: Employees are strictly forbidden from accessing another employee\'s private records.',
        });
      }

      if (payslipId) {
        const ps = await prisma.employeePayslip.findFirst({
          where: { id: payslipId, companyId },
          select: { employeeProfileId: true },
        });
        if (!ps || ps.employeeProfileId !== myProfile.id) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN_ESS_VIOLATION',
            message: 'Access denied: You cannot access another employee\'s payslip.',
          });
        }
      }

      if (documentId) {
        const doc = await prisma.employeeDocument.findFirst({
          where: { id: documentId, companyId },
          select: { employeeProfileId: true },
        });
        if (!doc || doc.employeeProfileId !== myProfile.id) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN_ESS_VIOLATION',
            message: 'Access denied: You cannot access another employee\'s document.',
          });
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// PUBLIC ROUTES (EXEMPT FROM AUTHENTICATION HEADER)
// ============================================================================

// Public Token-based Payslip Retrieval
router.get('/hrms/payslips/token/:token', payrollController.getPayslipByToken);

// ============================================================================
// COMPANY-SCOPED AUTHENTICATED HRMS ROUTES
// ============================================================================

const hrmsBase = '/companies/:companyId/hrms';

router.use(hrmsBase, requireCompanyUser, validateCompanyAccess);

// --- 1. Employee Master & Designations ---
router.post(`${hrmsBase}/designations`, requireHrManager, employeeController.createDesignation);
router.get(`${hrmsBase}/designations`, employeeController.listDesignations);
router.get(`${hrmsBase}/designations/:designationId`, employeeController.getDesignationById);
router.put(`${hrmsBase}/designations/:designationId`, requireHrManager, employeeController.updateDesignation);
router.delete(`${hrmsBase}/designations/:designationId`, requireHrManager, employeeController.deleteDesignation);

router.post(`${hrmsBase}/employees`, requireHrManager, employeeController.createProfile);
router.get(`${hrmsBase}/employees`, employeeController.listProfiles);
router.get(`${hrmsBase}/employees/:profileId`, validateEmployeeSelfService, employeeController.getProfileById);
router.put(`${hrmsBase}/employees/:profileId`, requireHrManager, employeeController.updateProfile);
router.post(`${hrmsBase}/employees/:profileId/link-user`, requireHrManager, employeeController.linkCompanyEmployee);
router.post(`${hrmsBase}/employees/:profileId/unlink-user`, requireHrManager, employeeController.unlinkCompanyEmployee);

// --- 2. Onboarding & KYC ---
router.get(`${hrmsBase}/employees/:profileId/kyc`, validateEmployeeSelfService, kycController.getKycRecord);
router.post(`${hrmsBase}/employees/:profileId/kyc/verify-field`, requireHrManager, kycController.verifyKycField);
router.post(`${hrmsBase}/employees/:profileId/kyc/submit-approval`, kycController.submitKycApproval);
router.post(`${hrmsBase}/employees/:profileId/kyc/decision`, requireHrManager, kycController.processApprovalDecision);

// --- 3. Employee Document Vault ---
router.post(`${hrmsBase}/employees/:profileId/documents`, validateEmployeeSelfService, upload.single('file'), documentController.uploadDocument);
router.get(`${hrmsBase}/employees/:profileId/documents`, validateEmployeeSelfService, documentController.listDocuments);
router.get(`${hrmsBase}/documents/expiring`, requireHrManager, documentController.getExpiringDocuments);
router.get(`${hrmsBase}/documents/:documentId`, validateEmployeeSelfService, documentController.getDocumentById);
router.patch(`${hrmsBase}/documents/:documentId/verify`, requireHrManager, documentController.verifyDocument);
router.delete(`${hrmsBase}/documents/:documentId`, requireHrManager, documentController.deleteDocument);

// --- 4. Shift Management ---
router.post(`${hrmsBase}/shifts`, requireHrManager, shiftController.createShiftPolicy);
router.get(`${hrmsBase}/shifts`, shiftController.listShiftPolicies);
router.get(`${hrmsBase}/shifts/:shiftId`, shiftController.getShiftPolicyById);
router.put(`${hrmsBase}/shifts/:shiftId`, requireHrManager, shiftController.updateShiftPolicy);
router.post(`${hrmsBase}/shifts/roster/assign`, requireHrManager, shiftController.assignShiftRoster);
router.get(`${hrmsBase}/employees/:profileId/roster`, validateEmployeeSelfService, shiftController.getEmployeeRoster);

// --- 5. Daily Attendance ---
router.post(`${hrmsBase}/attendance/check-in`, attendanceController.recordCheckIn);
router.post(`${hrmsBase}/attendance/check-out`, attendanceController.recordCheckOut);
router.get(`${hrmsBase}/attendance`, attendanceController.listAttendance);
router.get(`${hrmsBase}/attendance/aggregation`, requireHrManager, attendanceController.getMonthlyAggregation);
router.post(`${hrmsBase}/attendance/regularize`, attendanceController.requestRegularization);
router.post(`${hrmsBase}/attendance/regularize/:regularizationId/decision`, requireHrManager, attendanceController.approveRegularization);

// --- 6. Leave Management ---
router.post(`${hrmsBase}/leaves/types`, requireHrManager, leaveController.createLeaveType);
router.get(`${hrmsBase}/leaves/types`, leaveController.listLeaveTypes);
router.post(`${hrmsBase}/leaves/policies`, requireHrManager, leaveController.createLeavePolicy);
router.get(`${hrmsBase}/leaves/policies`, leaveController.listLeavePolicies);
router.get(`${hrmsBase}/employees/:profileId/leaves/balances`, validateEmployeeSelfService, leaveController.getLeaveBalances);
router.post(`${hrmsBase}/leaves/requests`, attendanceController.requestRegularization ? leaveController.applyLeave : leaveController.applyLeave);
router.get(`${hrmsBase}/leaves/requests`, leaveController.listLeaveRequests);
router.post(`${hrmsBase}/leaves/requests/:leaveRequestId/approve`, requireHrManager, leaveController.approveLeave);
router.post(`${hrmsBase}/leaves/requests/:leaveRequestId/reject`, requireHrManager, leaveController.rejectLeave);
router.post(`${hrmsBase}/leaves/requests/:leaveRequestId/cancel`, leaveController.cancelLeave);

// --- 7. Biometric Integration ---
router.post(`${hrmsBase}/biometric/devices`, requireHrManager, biometricController.registerDevice);
router.get(`${hrmsBase}/biometric/devices`, biometricController.listDevices);
router.post(`${hrmsBase}/biometric/ping/:deviceSerial`, biometricController.updateDevicePing);
router.post(`${hrmsBase}/biometric/ingest`, biometricController.ingestPunchLogs);
router.post(`${hrmsBase}/biometric/process`, requireHrManager, biometricController.processUnprocessedPunches);

// --- 8. Compensation & Statutory Rules ---
router.post(`${hrmsBase}/compensation/components`, requireHrManager, compensationController.createComponent);
router.get(`${hrmsBase}/compensation/components`, compensationController.listComponents);
router.post(`${hrmsBase}/compensation/structures`, requireHrManager, compensationController.createStructure);
router.get(`${hrmsBase}/compensation/structures`, compensationController.listStructures);
router.get(`${hrmsBase}/compensation/structures/:structureId`, compensationController.getStructureById);
router.post(`${hrmsBase}/compensation/assign`, requireHrManager, compensationController.assignSalary);
router.get(`${hrmsBase}/employees/:profileId/compensation/history`, validateEmployeeSelfService, compensationController.getSalaryHistory);
router.post(`${hrmsBase}/statutory/rules`, requireHrManager, compensationController.setStatutoryRule);
router.get(`${hrmsBase}/statutory/rules`, compensationController.listStatutoryRules);
router.post(`${hrmsBase}/statutory/preview`, compensationController.calculateStatutoryPreview);

// --- 9. Monthly Payroll Processing & Payslips ---
router.post(`${hrmsBase}/payroll/batches`, requireHrManager, payrollController.createBatch);
router.get(`${hrmsBase}/payroll/batches`, requireHrManager, payrollController.listBatches);
router.get(`${hrmsBase}/payroll/batches/:batchId`, requireHrManager, payrollController.getBatchById);
router.post(`${hrmsBase}/payroll/batches/:batchId/calculate`, requireHrManager, payrollController.calculateBatch);
router.post(`${hrmsBase}/payroll/batches/:batchId/submit-approval`, requireHrManager, payrollController.submitForApproval);
router.post(`${hrmsBase}/payroll/batches/:batchId/approve`, requireHrManager, payrollController.approveBatch);
router.post(`${hrmsBase}/payroll/batches/:batchId/post-gl`, requireHrManager, payrollController.postToGeneralLedger);
router.get(`${hrmsBase}/payroll/batches/:batchId/disbursement-csv`, requireHrManager, payrollController.generateDisbursementCsv);
router.post(`${hrmsBase}/payroll/batches/:batchId/disburse`, requireHrManager, payrollController.markAsDisbursed);

router.get(`${hrmsBase}/employees/:profileId/payslips`, validateEmployeeSelfService, payrollController.getEmployeePayslips);
router.get(`${hrmsBase}/payslips/:payslipId/html`, validateEmployeeSelfService, payrollController.getPayslipHtml);

export default router;
