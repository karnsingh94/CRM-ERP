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

async function runPhase9IntegrationTests() {
  console.log('========================================================================');
  console.log('   AZZUNIQE CRM & ERP — PHASE 9 HRMS & PAYROLL BACKEND SUITE          ');
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

  // 2. Provision Isolated Test Tenant
  const testCompany = await prisma.clientAdmin.create({
    data: {
      name: `HRMS Co ${nonce}`,
      email: `hrms_${nonce}@company.com`,
      organizationName: `HRMS Corporation ${nonce}`,
      passwordHash: 'dummyhash',
    },
  });
  const companyId = testCompany.id;
  const adminActor = { id: 'admin-user-id', userId: 'admin-user-id', name: 'HR Admin', role: 'COMPANY_ADMIN' };
  const checkerActor = { id: 'checker-user-id', userId: 'checker-user-id', name: 'Finance Controller', role: 'COMPANY_ADMIN' };

  // =========================================================================
  // TEST SUITE 1: Employee Master & Designations
  // =========================================================================
  let desig1, profile1, profile2;
  await test('1. Employee Designation CRUD & unique code per company', async () => {
    desig1 = await employeeService.createDesignation(
      companyId,
      { code: `ENG-${nonce}`, title: 'Senior Software Engineer', level: 3, minSalary: 80000, maxSalary: 150000 },
      adminActor
    );
    assert.strictEqual(desig1.code, `ENG-${nonce}`);
    assert.strictEqual(desig1.level, 3);

    // Duplicate rejection
    await assert.rejects(
      () => employeeService.createDesignation(companyId, { code: `ENG-${nonce}`, title: 'Dup' }, adminActor),
      /already exists/
    );
  });

  await test('2. Employee Profile Creation, Code Auto-generation & PII Encryption', async () => {
    profile1 = await employeeService.createProfile(
      companyId,
      {
        firstName: 'Rahul',
        lastName: 'Sharma',
        dateOfJoining: '2026-01-15',
        designationId: desig1.id,
        workEmail: `rahul_${nonce}@company.com`,
        phone: '9876543210',
        pan: 'ABCDE1234F',
        aadhaar: '123456789012',
        bankName: 'HDFC Bank',
        bankAccount: '12345678901234',
        bankIfsc: 'HDFC0001234',
      },
      adminActor
    );

    assert.ok(profile1.employeeCode.startsWith('EMP-'));
    assert.strictEqual(profile1.panMasked, 'ABCDE****F');
    assert.strictEqual(profile1.aadhaarMasked, '********9012');
    assert.strictEqual(profile1.bankAccountMasked, '**********1234');

    // Verify raw encrypted values in DB
    const raw = await prisma.employeeProfile.findUnique({ where: { id: profile1.id } });
    assert.notStrictEqual(raw.panEncrypted, 'ABCDE1234F');
    assert.ok(raw.panEncrypted.length > 20);

    // Create a second employee under profile1 (manager)
    profile2 = await employeeService.createProfile(
      companyId,
      {
        firstName: 'Priya',
        lastName: 'Patel',
        dateOfJoining: '2026-02-01',
        designationId: desig1.id,
        reportingManagerId: profile1.id,
        workEmail: `priya_${nonce}@company.com`,
        phone: '9876543211',
      },
      adminActor
    );
    assert.strictEqual(profile2.reportingManagerId, profile1.id);
  });

  // =========================================================================
  // TEST SUITE 2: Onboarding & KYC Maker-Checker Verification
  // =========================================================================
  await test('3. KYC Document submission & Maker-Checker Verification', async () => {
    const kyc = await kycService.getKycRecord(companyId, profile1.id);
    assert.strictEqual(kyc.overallStatus, 'PENDING');

    // Maker-checker: Verify PAN
    const verifiedPan = await kycService.verifyKycField(companyId, profile1.id, 'PAN', 'VERIFIED', 'PAN card verified', checkerActor);
    assert.strictEqual(verifiedPan.panStatus, 'VERIFIED');

    // Verify Aadhaar & Bank
    await kycService.verifyKycField(companyId, profile1.id, 'AADHAAR', 'VERIFIED', 'Aadhaar matched', checkerActor);
    const fullyVerified = await kycService.verifyKycField(companyId, profile1.id, 'BANK', 'VERIFIED', 'Cancelled cheque matched', checkerActor);

    assert.strictEqual(fullyVerified.overallStatus, 'VERIFIED');
  });

  // =========================================================================
  // TEST SUITE 3: Employee Document Vault
  // =========================================================================
  let doc1;
  await test('4. Employee Document Vault upload, verification & expiring search', async () => {
    const futureExpiry = new Date();
    futureExpiry.setDate(futureExpiry.getDate() + 15);

    doc1 = await documentService.uploadDocument(
      companyId,
      profile1.id,
      {
        documentType: 'ID_PROOF',
        title: 'Passport Copy',
        documentNumber: 'Z1234567',
        expiryDate: futureExpiry,
      },
      null,
      adminActor
    );
    assert.strictEqual(doc1.documentType, 'ID_PROOF');
    assert.strictEqual(doc1.isVerified, false);

    // Verify document
    const verifiedDoc = await documentService.verifyDocument(companyId, doc1.id, { isVerified: true }, checkerActor);
    assert.strictEqual(verifiedDoc.isVerified, true);

    // Expiring document check
    const expiring = await documentService.getExpiringDocuments(companyId, 30);
    assert.ok(expiring.some((d) => d.id === doc1.id));
  });

  // =========================================================================
  // TEST SUITE 4: Shift Management & Overnight Crossover
  // =========================================================================
  let shiftNormal, shiftOvernight;
  await test('5. Shift Policies with normal & overnight crossover support', async () => {
    shiftNormal = await shiftService.createShiftPolicy(
      companyId,
      {
        shiftName: 'General Day Shift',
        shiftCode: `GEN-${nonce}`,
        startTime: '09:00',
        endTime: '18:00',
        graceMinutes: 15,
        isDefault: true,
      },
      adminActor
    );
    assert.strictEqual(shiftNormal.isOvernight, false);
    assert.strictEqual(shiftNormal.isDefault, true);

    shiftOvernight = await shiftService.createShiftPolicy(
      companyId,
      {
        shiftName: 'Night Shift',
        shiftCode: `NGT-${nonce}`,
        startTime: '21:00',
        endTime: '06:00',
        isOvernight: true,
      },
      adminActor
    );
    assert.strictEqual(shiftOvernight.isOvernight, true);

    // Assign roster
    const roster = await shiftService.assignShiftRoster(
      companyId,
      {
        employeeProfileId: profile1.id,
        shiftId: shiftNormal.id,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      adminActor
    );
    assert.strictEqual(roster.length, 1);
  });

  // =========================================================================
  // TEST SUITE 5: Daily Attendance, Metrics & Regularization
  // =========================================================================
  await test('6. Daily Attendance check-in, check-out metrics & regularization', async () => {
    // Normal In & Out
    const inTime = new Date('2026-03-10T09:10:00Z'); // 10 mins late within 15 mins grace -> lateMinutes 0
    const outTime = new Date('2026-03-10T18:10:00Z'); // 9 hours total, 1 hr break -> 8 net work hours

    const checkInRec = await attendanceService.recordCheckIn(companyId, profile1.id, inTime, 'WEB', adminActor);
    assert.strictEqual(checkInRec.status, 'PRESENT');

    const checkOutRec = await attendanceService.recordCheckOut(companyId, profile1.id, outTime, 'WEB', adminActor);
    assert.strictEqual(Number(checkOutRec.totalWorkHours), 8);
    assert.strictEqual(checkOutRec.status, 'PRESENT');

    // Duplicate check-in on same day rejection
    await assert.rejects(
      () => attendanceService.recordCheckIn(companyId, profile1.id, inTime, 'WEB', adminActor),
      /already recorded/
    );

    // Regularization request
    const reg = await attendanceService.requestRegularization(
      companyId,
      {
        employeeProfileId: profile1.id,
        attendanceDate: '2026-03-11',
        requestedInTime: '2026-03-11T09:00:00Z',
        requestedOutTime: '2026-03-11T18:00:00Z',
        reason: 'Biometric device network failure',
      },
      adminActor
    );
    assert.strictEqual(reg.status, 'PENDING');

    // Approve regularization
    const approvedReg = await attendanceService.approveRegularization(companyId, reg.id, 'APPROVED', null, checkerActor);
    assert.strictEqual(approvedReg.status, 'APPROVED');

    // Verify daily attendance was created by regularization
    const regAtt = await prisma.dailyAttendance.findFirst({
      where: { companyId, employeeProfileId: profile1.id, attendanceDate: new Date('2026-03-11T00:00:00.000Z') },
    });
    assert.ok(regAtt);
    assert.strictEqual(regAtt.isRegularized, true);
  });

  // =========================================================================
  // TEST SUITE 6: Biometric Integration & Deduplication
  // =========================================================================
  await test('7. Biometric device registration, punch ingestion & deduplication', async () => {
    const device = await biometricService.registerDevice(
      companyId,
      {
        deviceName: 'Head Office Turnstile',
        deviceSerial: `BIO-SN-${nonce}`,
        ipAddress: '192.168.1.100',
      },
      adminActor
    );
    assert.strictEqual(device.deviceSerial, `BIO-SN-${nonce}`);

    const punchTime = new Date('2026-03-12T09:05:00Z');
    const punches = [
      { biometricUserId: profile1.employeeCode, punchTime, punchType: 'CHECK_IN' },
      // Duplicate punch within 60s
      { biometricUserId: profile1.employeeCode, punchTime: new Date(punchTime.getTime() + 10000), punchType: 'CHECK_IN' },
    ];

    const ingestResult = await biometricService.ingestPunchLogs(companyId, { deviceSerial: device.deviceSerial, punches }, adminActor);
    assert.strictEqual(ingestResult.ingestedCount, 1);
    assert.strictEqual(ingestResult.duplicateCount, 1);

    // Process raw punches into daily attendance
    const procResult = await biometricService.processUnprocessedPunches(companyId, 50);
    assert.strictEqual(procResult.processedCount, 1);
  });

  // =========================================================================
  // TEST SUITE 7: Leave Management & Atomic Balance Movement
  // =========================================================================
  await test('8. Leave types, policies, application, balance deduction & restoration', async () => {
    const leaveType = await leaveService.createLeaveType(
      companyId,
      { name: 'Paid Leave', code: `PL-${nonce}`, isPaid: true, allowHalfDay: true },
      adminActor
    );

    await leaveService.createLeavePolicy(
      companyId,
      { leaveTypeId: leaveType.id, annualQuota: 18, effectiveFrom: '2026-01-01' },
      adminActor
    );

    // Verify initial balance
    const balances = await leaveService.getLeaveBalances(companyId, profile1.id, 2026);
    const plBal = balances.find((b) => b.leaveTypeId === leaveType.id);
    assert.strictEqual(Number(plBal.currentBalance), 18);

    // Apply 2 days leave
    const leaveApp = await leaveService.applyLeave(
      companyId,
      {
        employeeProfileId: profile1.id,
        leaveTypeId: leaveType.id,
        startDate: '2026-03-16',
        endDate: '2026-03-17',
        reason: 'Personal family event',
      },
      adminActor
    );
    assert.strictEqual(Number(leaveApp.daysCount), 2);

    // Approve leave -> balance decreases to 16
    await leaveService.approveLeave(companyId, leaveApp.id, checkerActor);
    const updatedBal = await prisma.employeeLeaveBalance.findUnique({
      where: {
        companyId_employeeProfileId_leaveTypeId_year: {
          companyId,
          employeeProfileId: profile1.id,
          leaveTypeId: leaveType.id,
          year: 2026,
        },
      },
    });
    assert.strictEqual(Number(updatedBal.currentBalance), 16);
    assert.strictEqual(Number(updatedBal.used), 2);

    // Cancel leave -> balance restored to 18
    await leaveService.cancelLeave(companyId, leaveApp.id, adminActor);
    const restoredBal = await prisma.employeeLeaveBalance.findUnique({
      where: {
        companyId_employeeProfileId_leaveTypeId_year: {
          companyId,
          employeeProfileId: profile1.id,
          leaveTypeId: leaveType.id,
          year: 2026,
        },
      },
    });
    assert.strictEqual(Number(restoredBal.currentBalance), 18);
    assert.strictEqual(Number(restoredBal.used), 0);
  });

  // =========================================================================
  // TEST SUITE 8: Salary Structure, Decimal Precision & Effective-Dated Assignment
  // =========================================================================
  let structure1;
  await test('9. Salary Component, Structure Template & Effective-Dated Assignment', async () => {
    const compBasic = await salaryStructureService.createComponent(
      companyId,
      { name: 'Basic Pay', code: `BASIC_${nonce}`, type: 'EARNING', calculationType: 'PERCENTAGE' },
      adminActor
    );

    structure1 = await salaryStructureService.createStructure(
      companyId,
      {
        name: 'Standard Tech CTC Structure',
        code: `TECH-${nonce}`,
        componentsJson: [
          { code: 'BASIC', name: 'Basic Pay', type: 'EARNING', formulaType: 'PERCENTAGE_OF_CTC', value: 50 },
          { code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', formulaType: 'PERCENTAGE_OF_CTC', value: 20 },
        ],
      },
      adminActor
    );

    // Assign CTC ₹12,00,000 per annum (₹1,00,000 per month)
    const assignment1 = await salaryStructureService.assignSalary(
      companyId,
      {
        employeeProfileId: profile1.id,
        salaryStructureId: structure1.id,
        ctcAnnual: 1200000,
        effectiveFrom: '2026-01-01',
        revisionReason: 'Joining CTC',
      },
      adminActor
    );
    assert.strictEqual(Number(assignment1.ctcMonthly), 100000);

    // Check revision: supersede assignment with increment to ₹14,40,000 (₹1,20,000/mo)
    const assignment2 = await salaryStructureService.assignSalary(
      companyId,
      {
        employeeProfileId: profile1.id,
        salaryStructureId: structure1.id,
        ctcAnnual: 1440000,
        effectiveFrom: '2026-04-01',
        revisionReason: 'Annual Appraisal',
      },
      adminActor
    );
    assert.strictEqual(Number(assignment2.ctcMonthly), 120000);

    // Verify assignment 1 status updated to SUPERSEDED
    const prev = await prisma.employeeSalaryAssignment.findUnique({ where: { id: assignment1.id } });
    assert.strictEqual(prev.status, 'SUPERSEDED');
    assert.ok(prev.effectiveTo);
  });

  // =========================================================================
  // TEST SUITE 9: Statutory Rules (EPF, ESIC, PT, TDS)
  // =========================================================================
  await test('10. Statutory Rule Configurations & Deterministic Computations', async () => {
    // Set custom EPF rule
    await statutoryService.setRule(
      companyId,
      {
        ruleType: 'EPF',
        effectiveFrom: '2026-01-01',
        configJson: { employeeRatePct: 12, employerRatePct: 12, wageCeiling: 15000, enforceCeiling: true },
      },
      adminActor
    );

    const epfCalc = await statutoryService.calculateEpf(companyId, 50000);
    // Ceiling enforced at 15000 -> 12% is ₹1800
    assert.strictEqual(epfCalc.eligibleWage, 15000);
    assert.strictEqual(epfCalc.employeePf, 1800);
    assert.strictEqual(epfCalc.employerPf, 1800);

    // PT calculation
    const ptCalc = await statutoryService.calculateProfessionalTax(companyId, 60000, 'MAHARASHTRA', 5);
    assert.strictEqual(ptCalc.ptAmount, 200);
  });

  // =========================================================================
  // TEST SUITE 10: Monthly Payroll Batch, GL Voucher & Double-Entry Invariance
  // =========================================================================
  let payrollBatch;
  await test('11. Payroll Batch Calculation, Approval, Double-Entry GL Posting & Invariance', async () => {
    // Assign CTC to profile2 as well
    await salaryStructureService.assignSalary(
      companyId,
      {
        employeeProfileId: profile2.id,
        salaryStructureId: structure1.id,
        ctcAnnual: 600000,
        effectiveFrom: '2026-01-01',
      },
      adminActor
    );

    // Create payroll batch for March 2026
    payrollBatch = await payrollService.createBatch(companyId, { month: 3, year: 2026 }, adminActor);
    assert.strictEqual(payrollBatch.status, 'DRAFT');

    // Calculate payroll
    const calculated = await payrollService.calculateBatch(companyId, payrollBatch.id, adminActor);
    assert.strictEqual(calculated.status, 'CALCULATED');
    assert.strictEqual(calculated.totalEmployees, 2);
    assert.ok(Number(calculated.totalGross) > 0);
    assert.ok(Number(calculated.totalNet) > 0);

    // Approve batch (Maker-checker: checkerActor approves batch processed by adminActor)
    const approved = await payrollService.approveBatch(companyId, payrollBatch.id, checkerActor);
    assert.strictEqual(approved.status, 'APPROVED');

    // Verify payslips were provisioned
    const payslips = await prisma.employeePayslip.findMany({ where: { companyId, month: 3, year: 2026 } });
    assert.strictEqual(payslips.length, 2);
    assert.ok(payslips[0].downloadToken);

    // Post to General Ledger via Phase 8 Accounting Core
    const postedBatch = await payrollService.postToGeneralLedger(companyId, payrollBatch.id, adminActor);
    assert.strictEqual(postedBatch.status, 'POSTED_TO_GL');
    assert.ok(postedBatch.voucherId);

    // Verify linked JournalVoucher
    const voucher = await prisma.journalVoucher.findUnique({
      where: { id: postedBatch.voucherId },
      include: { items: true },
    });
    assert.ok(voucher);
    assert.strictEqual(voucher.status, 'POSTED');
    assert.strictEqual(Number(voucher.totalDebit), Number(voucher.totalCredit));
    console.log(`   [GL Invariance] Verified balanced double-entry: Total Dr ₹${voucher.totalDebit} == Total Cr ₹${voucher.totalCredit}`);
  });

  // =========================================================================
  // TEST SUITE 11: Payslip Snapshot, Secure Token & HTML Generator
  // =========================================================================
  await test('12. Payslip Secure Token Access & Clean HTML Generator', async () => {
    const payslip = await prisma.employeePayslip.findFirst({
      where: { companyId, employeeProfileId: profile1.id, month: 3, year: 2026 },
    });
    assert.ok(payslip);

    // Download by token (public route simulation)
    const tokenResult = await payslipService.getPayslipByToken(payslip.downloadToken);
    assert.strictEqual(tokenResult.payslipNumber, payslip.payslipNumber);
    assert.strictEqual(tokenResult.profile.panMasked, 'ABCDE****F');

    // Render HTML
    const html = await payslipService.getPayslipHtml(companyId, payslip.id, adminActor);
    assert.ok(html.includes('Payslip No:'));
    assert.ok(html.includes('Net Salary Payable:'));
  });

  // =========================================================================
  // TEST SUITE 12: Strict Multi-Tenant Isolation
  // =========================================================================
  await test('13. Multi-Tenant Isolation across companies', async () => {
    const otherCompany = await prisma.clientAdmin.create({
      data: {
        name: `Other Corp ${nonce}`,
        email: `other_${nonce}@corp.com`,
        organizationName: `Other Org ${nonce}`,
        passwordHash: 'dummyhash',
      },
    });

    // Querying profile1 under otherCompany must return null/reject
    await assert.rejects(
      () => employeeService.getProfileById(otherCompany.id, profile1.id),
      /not found/
    );

    // Querying payroll batch under otherCompany must reject
    await assert.rejects(
      () => payrollService.getBatchById(otherCompany.id, payrollBatch.id),
      /not found/
    );
  });

  console.log('\n========================================================================');
  console.log(`   ALL ${passedCount} PHASE 9 HRMS & PAYROLL TESTS PASSED!            `);
  console.log('========================================================================\n');

  await prisma.$disconnect();
}

runPhase9IntegrationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 9 HRMS integration suite failed:', err);
    process.exit(1);
  });

