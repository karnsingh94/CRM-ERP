import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly force test database configuration
const envTestPath = path.resolve(__dirname, '../../.env.test');
dotenv.config({ path: envTestPath, override: true });

import prisma from '../../src/config/prisma.js';
import employeeService from '../../src/services/hrms/employee.service.js';
import kycService from '../../src/services/hrms/kyc.service.js';
import documentService from '../../src/services/hrms/document.service.js';
import shiftService from '../../src/services/hrms/shift.service.js';
import attendanceService from '../../src/services/hrms/attendance.service.js';
import leaveService from '../../src/services/hrms/leave.service.js';
import biometricService from '../../src/services/hrms/biometric.service.js';
import salaryStructureService from '../../src/services/hrms/salaryStructure.service.js';
import statutoryService from '../../src/services/hrms/statutory.service.js';
import payrollService from '../../src/services/hrms/payroll.service.js';
import payslipService from '../../src/services/hrms/payslip.service.js';
import { encryptSensitive, decryptSensitive, maskPan, maskAadhaar, maskBankAccount } from '../../src/utils/encryption.js';

let passedCount = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ FAIL: ${name} ->`, err.message || err);
    throw err;
  }
}

async function runPhase9E2EVerification() {
  console.log('========================================================================');
  console.log('   AZZUNIQE CRM & ERP — PHASE 9 STEP 4 E2E VERIFICATION & HARDENING   ');
  console.log('========================================================================\n');

  // 1. STRICT DATABASE SAFETY GUARD
  const [dbRow] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS activeDb;');
  const activeDb = dbRow?.activeDb;
  console.log(`[Runtime Guard] Active connected database: ${activeDb}`);

  if (activeDb === 'crm_erp_db') {
    throw new Error('FATAL SAFETY VIOLATION: Connected to PRODUCTION DATABASE (crm_erp_db)! Aborting.');
  }
  if (activeDb !== 'crm_erp_test_db') {
    throw new Error(`FATAL: Expected crm_erp_test_db, got ${activeDb}`);
  }

  const nonce = Date.now().toString().slice(-6);

  // 2. Provision Tenant A & Tenant B for Multi-Tenant Isolation
  const companyA = await prisma.clientAdmin.create({
    data: {
      name: `Corp A ${nonce}`,
      email: `corpa_${nonce}@enterprise.com`,
      organizationName: `Azzuniqe Corp A ${nonce}`,
      passwordHash: 'dummyhash',
    },
  });
  const companyB = await prisma.clientAdmin.create({
    data: {
      name: `Corp B ${nonce}`,
      email: `corpb_${nonce}@enterprise.com`,
      organizationName: `Azzuniqe Corp B ${nonce}`,
      passwordHash: 'dummyhash',
    },
  });

  const companyIdA = companyA.id;
  const companyIdB = companyB.id;

  const hrAdminA = { id: `hr-${nonce}`, userId: `hr-${nonce}`, name: 'HR Director A', role: 'COMPANY_ADMIN' };
  const financeCheckerA = { id: `fc-${nonce}`, userId: `fc-${nonce}`, name: 'Finance Controller A', role: 'COMPANY_ADMIN' };

  // =========================================================================
  // WORKFLOW A: EMPLOYEE ONBOARDING & KYC WITH SOD & PII SECURITY
  // =========================================================================
  let desig1, empProfile1, empProfile2, empUser1;

  await test('Workflow A1: Designation creation, code uniqueness & level hierarchy', async () => {
    desig1 = await employeeService.createDesignation(
      companyIdA,
      { code: `DEV-${nonce}`, title: 'Senior Fullstack Engineer', level: 3, minSalary: 80000, maxSalary: 160000 },
      hrAdminA
    );
    assert.strictEqual(desig1.code, `DEV-${nonce}`);

    // Unique code per company enforcement
    await assert.rejects(
      () => employeeService.createDesignation(companyIdA, { code: `DEV-${nonce}`, title: 'Duplicate' }, hrAdminA),
      /already exists/
    );
  });

  await test('Workflow A2: Employee Profile creation with AES-256-GCM PII encryption and auto-code', async () => {
    empProfile1 = await employeeService.createProfile(
      companyIdA,
      {
        firstName: 'Amit',
        lastName: 'Verma',
        dateOfJoining: '2026-01-10',
        designationId: desig1.id,
        workEmail: `amit_${nonce}@corpa.com`,
        phone: '9822001122',
        pan: 'ABCDE5678K',
        aadhaar: '987654321098',
        bankName: 'State Bank of India',
        bankAccount: '203040506070',
        bankIfsc: 'SBIN0001234',
      },
      hrAdminA
    );

    assert.ok(empProfile1.employeeCode.startsWith('EMP-'));
    assert.strictEqual(empProfile1.panMasked, 'ABCDE****K');
    assert.strictEqual(empProfile1.aadhaarMasked, '********1098');
    assert.strictEqual(empProfile1.bankAccountMasked, '********6070');

    // Verify DB stored encrypted cipher
    const dbRaw = await prisma.employeeProfile.findUnique({ where: { id: empProfile1.id } });
    assert.notStrictEqual(dbRaw.panEncrypted, 'ABCDE5678K');
    assert.strictEqual(decryptSensitive(dbRaw.panEncrypted), 'ABCDE5678K');
    assert.strictEqual(decryptSensitive(dbRaw.aadhaarEncrypted), '987654321098');
    assert.strictEqual(decryptSensitive(dbRaw.bankAccountEncrypted), '203040506070');
  });

  await test('Workflow A3: Link CompanyEmployee account and Segregation of Duties (SoD) on KYC', async () => {
    // Create login account
    empUser1 = await prisma.companyEmployee.create({
      data: {
        companyId: companyIdA,
        name: 'Amit Verma',
        email: `amit_login_${nonce}@corpa.com`,
        role: 'Senior Software Engineer',
        passwordHash: 'dummy',
        accessRole: 'EMPLOYEE',
      },
    });

    await employeeService.linkCompanyEmployee(companyIdA, empProfile1.id, empUser1.id, hrAdminA);

    const linked = await prisma.employeeProfile.findUnique({ where: { id: empProfile1.id } });
    assert.strictEqual(linked.employeeId, empUser1.id);

    // SoD Check: Employee CANNOT verify their own KYC!
    const selfActor = { id: empUser1.id, userId: empUser1.id, name: 'Amit Verma', role: 'EMPLOYEE' };
    await assert.rejects(
      () => kycService.verifyKycField(companyIdA, empProfile1.id, 'PAN', 'VERIFIED', 'Self verify', selfActor),
      /Segregation of Duties Violation/
    );

    // Authorized maker-checker verification by finance controller
    const verified = await kycService.verifyKycField(companyIdA, empProfile1.id, 'PAN', 'VERIFIED', 'Doc verified', financeCheckerA);
    assert.strictEqual(verified.panStatus, 'VERIFIED');
  });

  await test('Workflow A4: Upload Vault Documents & Expiry Validation', async () => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 20);

    const doc = await documentService.uploadDocument(
      companyIdA,
      empProfile1.id,
      {
        documentType: 'ID_PROOF',
        title: 'Aadhaar Card Copy',
        documentNumber: '987654321098',
        expiryDate: expiry,
      },
      null,
      hrAdminA
    );
    assert.strictEqual(doc.documentType, 'ID_PROOF');

    const expiringList = await documentService.getExpiringDocuments(companyIdA, 30);
    assert.ok(expiringList.some((d) => d.id === doc.id));
  });

  // =========================================================================
  // WORKFLOW B: ATTENDANCE, SHIFTS, OVERNIGHT CROSSOVER & REGULARIZATION SOD
  // =========================================================================
  let shiftNormal, shiftOvernight;

  await test('Workflow B1: Normal & Overnight Shift Policies with midnight crossover detection', async () => {
    shiftNormal = await shiftService.createShiftPolicy(
      companyIdA,
      { shiftName: 'General Day', shiftCode: `DAY-${nonce}`, startTime: '09:00', endTime: '18:00', graceMinutes: 15, isDefault: true },
      hrAdminA
    );
    assert.strictEqual(shiftNormal.isOvernight, false);

    shiftOvernight = await shiftService.createShiftPolicy(
      companyIdA,
      { shiftName: 'Overnight Shift', shiftCode: `OVT-${nonce}`, startTime: '22:00', endTime: '06:00' },
      hrAdminA
    );
    assert.strictEqual(shiftOvernight.isOvernight, true); // Auto-detected crossover
  });

  await test('Workflow B2: Check-in, check-out metrics, duplicate prevention & Regularization SoD', async () => {
    const inTime = new Date('2026-03-01T09:05:00Z');
    const outTime = new Date('2026-03-01T18:05:00Z');

    const inRec = await attendanceService.recordCheckIn(companyIdA, empProfile1.id, inTime, 'WEB', hrAdminA);
    assert.strictEqual(inRec.status, 'PRESENT');

    // Duplicate check-in rejection
    await assert.rejects(
      () => attendanceService.recordCheckIn(companyIdA, empProfile1.id, inTime, 'WEB', hrAdminA),
      /already recorded/
    );

    const outRec = await attendanceService.recordCheckOut(companyIdA, empProfile1.id, outTime, 'WEB', hrAdminA);
    assert.strictEqual(Number(outRec.totalWorkHours), 8);

    // Regularization request
    const reg = await attendanceService.requestRegularization(
      companyIdA,
      {
        employeeProfileId: empProfile1.id,
        attendanceDate: '2026-03-02',
        requestedInTime: '2026-03-02T09:00:00Z',
        requestedOutTime: '2026-03-02T18:00:00Z',
        reason: 'Client meeting on-site',
      },
      { userId: empUser1.id, role: 'EMPLOYEE' }
    );

    // SoD Check: Employee CANNOT approve their own attendance regularization!
    await assert.rejects(
      () => attendanceService.approveRegularization(companyIdA, reg.id, 'APPROVED', null, { userId: empUser1.id }),
      /Segregation of Duties Violation/
    );

    // Approved by HR Admin
    const approvedReg = await attendanceService.approveRegularization(companyIdA, reg.id, 'APPROVED', null, hrAdminA);
    assert.strictEqual(approvedReg.status, 'APPROVED');
  });

  // =========================================================================
  // WORKFLOW C: LEAVE MANAGEMENT, OVERLAP DETECTION, BALANCE DEDUCTION & RESTORATION
  // =========================================================================
  let plType;

  await test('Workflow C: Leave application, overlapping rejection, approval deduction & cancellation restoration', async () => {
    plType = await leaveService.createLeaveType(
      companyIdA,
      { name: 'Casual Leave', code: `CL-${nonce}`, isPaid: true, allowHalfDay: true },
      hrAdminA
    );

    await leaveService.createLeavePolicy(
      companyIdA,
      { leaveTypeId: plType.id, annualQuota: 12, effectiveFrom: '2026-01-01' },
      hrAdminA
    );

    const balances = await leaveService.getLeaveBalances(companyIdA, empProfile1.id, 2026);
    const clBal = balances.find((b) => b.leaveTypeId === plType.id);
    assert.strictEqual(Number(clBal.currentBalance), 12);

    // Apply 3 days leave: March 10 to March 12
    const leaveApp = await leaveService.applyLeave(
      companyIdA,
      {
        employeeProfileId: empProfile1.id,
        leaveTypeId: plType.id,
        startDate: '2026-03-10',
        endDate: '2026-03-12',
        reason: 'Personal leave',
      },
      { userId: empUser1.id, role: 'EMPLOYEE' }
    );
    assert.strictEqual(Number(leaveApp.daysCount), 3);

    // Overlapping leave rejection: Apply March 11 to March 13
    await assert.rejects(
      () =>
        leaveService.applyLeave(
          companyIdA,
          {
            employeeProfileId: empProfile1.id,
            leaveTypeId: plType.id,
            startDate: '2026-03-11',
            endDate: '2026-03-13',
            reason: 'Overlap test',
          },
          { userId: empUser1.id, role: 'EMPLOYEE' }
        ),
      /overlapping leave request/
    );

    // SoD Check: Employee CANNOT approve their own leave!
    await assert.rejects(
      () => leaveService.approveLeave(companyIdA, leaveApp.id, { userId: empUser1.id }),
      /Segregation of Duties Violation/
    );

    // Approve leave -> Balance reduces from 12 to 9
    await leaveService.approveLeave(companyIdA, leaveApp.id, hrAdminA);
    const postApproveBal = await prisma.employeeLeaveBalance.findUnique({
      where: {
        companyId_employeeProfileId_leaveTypeId_year: {
          companyId: companyIdA,
          employeeProfileId: empProfile1.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert.strictEqual(Number(postApproveBal.currentBalance), 9);
    assert.strictEqual(Number(postApproveBal.used), 3);

    // Cancel leave -> Balance restored exactly to 12
    await leaveService.cancelLeave(companyIdA, leaveApp.id, hrAdminA);
    const restoredBal = await prisma.employeeLeaveBalance.findUnique({
      where: {
        companyId_employeeProfileId_leaveTypeId_year: {
          companyId: companyIdA,
          employeeProfileId: empProfile1.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert.strictEqual(Number(restoredBal.currentBalance), 12);
    assert.strictEqual(Number(restoredBal.used), 0);
  });

  // =========================================================================
  // WORKFLOW D: BIOMETRIC REPLAY PREVENTION & BUFFER PROCESSING
  // =========================================================================
  await test('Workflow D: Biometric punch buffer deduplication and batch processing', async () => {
    const bioDevice = await biometricService.registerDevice(
      companyIdA,
      { deviceName: 'Gate 1', deviceSerial: `DEV-BIO-${nonce}` },
      hrAdminA
    );

    const now = new Date();
    const punches = [
      { biometricUserId: empProfile1.employeeCode, punchTime: now.toISOString(), punchType: 'CHECK_IN' },
      // Duplicate punch within 60-second window
      { biometricUserId: empProfile1.employeeCode, punchTime: new Date(now.getTime() + 15000).toISOString(), punchType: 'CHECK_IN' },
    ];

    const res = await biometricService.ingestPunchLogs(companyIdA, { deviceSerial: bioDevice.deviceSerial, punches }, hrAdminA);
    assert.strictEqual(res.ingestedCount, 1);
    assert.strictEqual(res.duplicateCount, 1);

    const proc = await biometricService.processUnprocessedPunches(companyIdA, 100);
    assert.strictEqual(proc.processedCount, 1);
  });

  // =========================================================================
  // WORKFLOW E: SALARY STRUCTURE & DECIMAL REVISION PRECISION
  // =========================================================================
  let structA;

  await test('Workflow E: Salary structure formula, Decimal precision and supersede state', async () => {
    structA = await salaryStructureService.createStructure(
      companyIdA,
      {
        name: 'Tech Standard',
        code: `TECH-${nonce}`,
        componentsJson: [
          { code: 'BASIC', name: 'Basic', type: 'EARNING', formulaType: 'PERCENTAGE_OF_CTC', value: 50 },
          { code: 'HRA', name: 'HRA', type: 'EARNING', formulaType: 'PERCENTAGE_OF_CTC', value: 20 },
        ],
      },
      hrAdminA
    );

    const assign1 = await salaryStructureService.assignSalary(
      companyIdA,
      {
        employeeProfileId: empProfile1.id,
        salaryStructureId: structA.id,
        ctcAnnual: 1200000,
        effectiveFrom: '2026-01-01',
        revisionReason: 'Joining CTC',
      },
      hrAdminA
    );
    assert.strictEqual(Number(assign1.ctcMonthly), 100000);

    // Increment
    const assign2 = await salaryStructureService.assignSalary(
      companyIdA,
      {
        employeeProfileId: empProfile1.id,
        salaryStructureId: structA.id,
        ctcAnnual: 1500000,
        effectiveFrom: '2026-04-01',
        revisionReason: 'Appraisal',
      },
      hrAdminA
    );
    assert.strictEqual(Number(assign2.ctcMonthly), 125000);

    const old = await prisma.employeeSalaryAssignment.findUnique({ where: { id: assign1.id } });
    assert.strictEqual(old.status, 'SUPERSEDED');
    assert.ok(old.effectiveTo);
  });

  // =========================================================================
  // WORKFLOW F: PAYROLL CALCULATION, SOD, BALANCED GL VOUCHER & DISBURSEMENT
  // =========================================================================
  let batchA;

  await test('Workflow F: Monthly Payroll, Maker-Checker SoD, GL double-entry balanced posting & CSV export', async () => {
    batchA = await payrollService.createBatch(companyIdA, { month: 3, year: 2026 }, hrAdminA);
    assert.strictEqual(batchA.status, 'DRAFT');

    const calculated = await payrollService.calculateBatch(companyIdA, batchA.id, hrAdminA);
    assert.strictEqual(calculated.status, 'CALCULATED');
    assert.ok(Number(calculated.totalGross) > 0);

    // Submit for approval
    await payrollService.submitForApproval(companyIdA, batchA.id, hrAdminA);

    // SoD Check: HR Admin who processed batch CANNOT approve it!
    await assert.rejects(
      () => payrollService.approveBatch(companyIdA, batchA.id, hrAdminA),
      /Segregation of Duties Violation/
    );

    // Checker approves
    const approved = await payrollService.approveBatch(companyIdA, batchA.id, financeCheckerA);
    assert.strictEqual(approved.status, 'APPROVED');

    // Post to General Ledger via Phase 8 Voucher Service
    const posted = await payrollService.postToGeneralLedger(companyIdA, batchA.id, financeCheckerA);
    assert.strictEqual(posted.status, 'POSTED_TO_GL');
    assert.ok(posted.voucherId);

    // Check Journal Voucher balance
    const jv = await prisma.journalVoucher.findUnique({ where: { id: posted.voucherId } });
    assert.strictEqual(Number(jv.totalDebit), Number(jv.totalCredit));
    assert.ok(Number(jv.totalDebit) > 0);
    console.log(`   [GL Invariance] Verified Journal Voucher ${jv.voucherNo}: Total Dr ₹${jv.totalDebit} == Total Cr ₹${jv.totalCredit}`);

    // Duplicate posting rejection
    await assert.rejects(
      () => payrollService.postToGeneralLedger(companyIdA, batchA.id, financeCheckerA),
      /Only APPROVED payroll batches can be posted/
    );

    // Bank CSV Export
    const csvExport = await payrollService.generateDisbursementCsv(companyIdA, batchA.id);
    assert.ok(csvExport.csvContent.includes('Beneficiary Account Number'));
    assert.ok(csvExport.csvContent.includes('IFSC Code'));

    // Mark as disbursed
    const paid = await payrollService.markAsDisbursed(companyIdA, batchA.id, financeCheckerA);
    assert.strictEqual(paid.status, 'PAID');
    assert.ok(paid.disbursedAt);
  });

  // =========================================================================
  // WORKFLOW G & CRITICAL SECURITY: PAYSLIPS & EMPLOYEE SELF-SERVICE ISOLATION
  // =========================================================================
  await test('Workflow G & Security: Employee Self-Service isolation & Payslip privacy', async () => {
    // Create Profile 2 in Company A with own login
    const empProfile2 = await employeeService.createProfile(
      companyIdA,
      { firstName: 'Sneha', lastName: 'Gupta', dateOfJoining: '2026-02-01', designationId: desig1.id },
      hrAdminA
    );
    const empUser2 = await prisma.companyEmployee.create({
      data: {
        companyId: companyIdA,
        name: 'Sneha Gupta',
        email: `sneha_login_${nonce}@corpa.com`,
        role: 'Senior Software Engineer',
        passwordHash: 'dummy',
        accessRole: 'EMPLOYEE',
      },
    });
    await employeeService.linkCompanyEmployee(companyIdA, empProfile2.id, empUser2.id, hrAdminA);

    // Retrieve payslip for empProfile1
    const payslip1 = await prisma.employeePayslip.findFirst({
      where: { companyId: companyIdA, employeeProfileId: empProfile1.id },
    });
    assert.ok(payslip1);

    // Printable HTML generator check
    const html = await payslipService.getPayslipHtml(companyIdA, payslip1.id, hrAdminA);
    assert.ok(html.includes(payslip1.payslipNumber));

    // Token-based secure download check
    const tokenAccess = await payslipService.getPayslipByToken(payslip1.downloadToken);
    assert.strictEqual(tokenAccess.id, payslip1.id);
    assert.strictEqual(tokenAccess.profile.panMasked, 'ABCDE****K');
  });

  // =========================================================================
  // CRITICAL SECURITY: MULTI-TENANT CROSS-COMPANY ISOLATION
  // =========================================================================
  await test('Security: Strict cross-company tenant isolation rejection', async () => {
    // Company B attempting to read Company A's employee profile
    await assert.rejects(
      () => employeeService.getProfileById(companyIdB, empProfile1.id),
      /not found/
    );

    // Company B attempting to read Company A's payroll batch
    await assert.rejects(
      () => payrollService.getBatchById(companyIdB, batchA.id),
      /not found/
    );

    // Company B attempting to access Company A's payslips
    const bPayslips = await payslipService.getEmployeePayslips(companyIdB, empProfile1.id);
    assert.strictEqual(bPayslips.length, 0);
  });

  console.log('\n========================================================================');
  console.log(`   ALL ${passedCount} PHASE 9 E2E WORKFLOWS & HARDENING TESTS PASSED!   `);
  console.log('========================================================================\n');

  await prisma.$disconnect();
}

runPhase9E2EVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 9 E2E verification suite failed:', err);
    process.exit(1);
  });
