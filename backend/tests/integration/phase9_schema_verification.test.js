import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envTestPath = path.resolve(__dirname, '../../.env.test');

dotenv.config({ path: envTestPath, override: true });

function sanitizeDbUrl(urlStr) {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    return parsed.pathname.replace(/^\//, '');
  } catch (err) {
    const match = urlStr.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : 'unknown';
  }
}

const configuredDbName = sanitizeDbUrl(process.env.DATABASE_URL);
console.log(`[Database Safety Guard] Configured Target Database: ${configuredDbName}`);

if (configuredDbName === 'crm_erp_db') {
  console.error('\nFATAL SAFETY VIOLATION: Test suite attempted to connect to PRODUCTION database (crm_erp_db)!');
  process.exit(1);
}

if (configuredDbName !== 'crm_erp_test_db') {
  console.error(`\nCONFIGURATION ERROR: Target database must be 'crm_erp_test_db', got '${configuredDbName}'.`);
  process.exit(1);
}

import prisma from '../../src/config/prisma.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;
let passedCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ FAIL: ${name} ->`, err.message);
    throw err;
  }
}

async function runPhase9SchemaVerification() {
  console.log('\n========================================================================');
  console.log('   AZZUNIQE CRM & ERP — PHASE 9 STEP 1 SCHEMA VERIFICATION SUITE       ');
  console.log('========================================================================\n');

  // Hard runtime check
  const [dbRow] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS activeDb;');
  const activeDb = dbRow?.activeDb;
  console.log(`[Runtime Guard] Active connected database: ${activeDb}`);

  if (activeDb !== 'crm_erp_test_db') {
    throw new Error(`FATAL: Test must run against crm_erp_test_db, connected to ${activeDb}`);
  }

  // Setup unique test tenant
  const nonce = Date.now().toString().slice(-6);
  const company = await prisma.clientAdmin.create({
    data: {
      name: `HRMS Test Company ${nonce}`,
      organizationName: `HRMS Test Org ${nonce}`,
      email: `admin_hrms_${nonce}@testcorp.com`,
      passwordHash: 'dummy-hashed-secret',
      status: 'ACTIVE',
    },
  });
  const companyId = company.id;

  // Setup service and department
  const service = await prisma.service.findFirst({ where: { code: 'hrms_payroll' } }) ||
    await prisma.service.create({
      data: { name: 'HRMS & Payroll', code: `hrms_payroll_${nonce}`, orderNo: 8 }
    });

  const department = await prisma.department.create({
    data: {
      companyId,
      serviceId: service.id,
      name: 'Human Resources',
      code: `HR-${nonce}`,
    },
  });

  // 1. Verify Existing CompanyEmployee compatibility & relation preservation
  let employeeUser;
  await test('1. Existing CompanyEmployee model preservation & backward compatibility', async () => {
    employeeUser = await prisma.companyEmployee.create({
      data: {
        companyId,
        departmentId: department.id,
        name: `Sunil Sharma ${nonce}`,
        email: `sunil_${nonce}@testcorp.com`,
        phone: '9876543210',
        role: 'HR Specialist',
        accessRole: 'EMPLOYEE',
      },
    });
    assert.ok(employeeUser.id, 'CompanyEmployee should be created with legacy fields intact');
  });

  // 2. EmployeeDesignation
  let designation;
  await test('2. EmployeeDesignation creation & unique code constraint per company', async () => {
    designation = await prisma.employeeDesignation.create({
      data: {
        companyId,
        code: `SR_ENG_${nonce}`,
        title: 'Senior Production Engineer',
        departmentId: department.id,
        level: 4,
        minSalary: new Decimal(600000.00),
        maxSalary: new Decimal(1200000.00),
      },
    });
    assert.strictEqual(designation.level, 4);

    // Duplicate code within same company must fail
    await assert.rejects(
      prisma.employeeDesignation.create({
        data: {
          companyId,
          code: `SR_ENG_${nonce}`,
          title: 'Duplicate Title',
        },
      }),
      /Unique constraint failed/
    );
  });

  // 3. EmployeeProfile with Masked & Encrypted Sensitive Fields
  let profile;
  await test('3. EmployeeProfile decoupled HR master & sensitive field encryption strategy', async () => {
    profile = await prisma.employeeProfile.create({
      data: {
        companyId,
        employeeId: employeeUser.id, // optional 1-to-1 link to user login account
        employeeCode: `EMP-${nonce}`,
        firstName: 'Sunil',
        lastName: 'Sharma',
        displayName: 'Sunil Sharma',
        gender: 'MALE',
        dateOfBirth: new Date('1992-05-15'),
        dateOfJoining: new Date('2024-01-10'),
        employmentStatus: 'CONFIRMED',
        employmentType: 'FULL_TIME',
        departmentId: department.id,
        designationId: designation.id,
        workEmail: employeeUser.email,
        phone: employeeUser.phone,
        // Bank details (Masked for read, encrypted for security)
        bankName: 'HDFC Bank',
        bankBranch: 'Kothrud Pune',
        bankIfsc: 'HDFC0001234',
        bankAccountMasked: 'XXXXXXXX7890',
        bankAccountEncrypted: 'enc_aes256_mock_hash_7890',
        // Statutory identifiers (Masked for read, encrypted for security)
        panMasked: 'ABCDE****F',
        panEncrypted: 'enc_aes256_mock_pan_ABCDE1234F',
        aadhaarMasked: 'XXXX-XXXX-9012',
        aadhaarEncrypted: 'enc_aes256_mock_aadhaar_123456789012',
        uanNumber: '100987654321',
        esicNumber: '3100987654321',
      },
    });

    assert.ok(profile.id);
    assert.strictEqual(profile.employeeCode, `EMP-${nonce}`);
    assert.strictEqual(profile.bankAccountMasked, 'XXXXXXXX7890');

    // Duplicate employeeCode per company must fail
    await assert.rejects(
      prisma.employeeProfile.create({
        data: {
          companyId,
          employeeCode: `EMP-${nonce}`,
          firstName: 'Another',
          displayName: 'Another Emp',
          dateOfJoining: new Date('2025-01-01'),
        },
      }),
      /Unique constraint failed/
    );
  });

  // 4. EmployeeKyc & EmployeeDocument
  await test('4. EmployeeKyc & EmployeeDocument relations and verification tracking', async () => {
    const kyc = await prisma.employeeKyc.create({
      data: {
        companyId,
        employeeProfileId: profile.id,
        panStatus: 'VERIFIED',
        panVerifiedAt: new Date(),
        aadhaarStatus: 'VERIFIED',
        aadhaarVerifiedAt: new Date(),
        bankStatus: 'VERIFIED',
        bankVerifiedAt: new Date(),
        overallStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });
    assert.strictEqual(kyc.overallStatus, 'VERIFIED');

    const doc = await prisma.employeeDocument.create({
      data: {
        companyId,
        employeeProfileId: profile.id,
        documentType: 'PAN',
        title: 'PAN Card Copy',
        documentNumber: 'ABCDE1234F',
        fileUrl: 'https://storage.local/docs/pan.pdf',
        fileName: 'pan.pdf',
        fileSize: 1048576,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    assert.strictEqual(doc.documentType, 'PAN');
  });

  // 5. ShiftPolicy & Overnight Shifts
  let shift;
  await test('5. ShiftPolicy master with overnight crossover support', async () => {
    shift = await prisma.shiftPolicy.create({
      data: {
        companyId,
        shiftName: 'Night Shift B',
        shiftCode: `NIGHT_${nonce}`,
        startTime: '22:00',
        endTime: '06:00',
        isOvernight: true, // Supports shifts crossing midnight
        graceMinutes: 15,
        breakDurationMinutes: 45,
        halfDayThresholdHours: new Decimal(4.00),
        fullDayThresholdHours: new Decimal(8.00),
      },
    });
    assert.strictEqual(shift.isOvernight, true);

    const roster = await prisma.employeeShiftRoster.create({
      data: {
        companyId,
        employeeProfileId: profile.id,
        shiftId: shift.id,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-31'),
        isWeeklyOff: false,
      },
    });
    assert.ok(roster.id);
  });

  // 6. DailyAttendance & Regularization
  await test('6. DailyAttendance register & attendance regularization request', async () => {
    const att = await prisma.dailyAttendance.create({
      data: {
        companyId,
        employeeProfileId: profile.id,
        attendanceDate: new Date('2026-10-15'),
        shiftId: shift.id,
        firstInTime: new Date('2026-10-15T22:05:00.000Z'),
        lastOutTime: new Date('2026-10-16T06:00:00.000Z'),
        totalWorkHours: new Decimal(7.92),
        lateMinutes: 5,
        status: 'PRESENT',
      },
    });
    assert.ok(att.id);

    const reg = await prisma.attendanceRegularization.create({
      data: {
        companyId,
        employeeProfileId: profile.id,
        attendanceDate: new Date('2026-10-16'),
        requestedInTime: new Date('2026-10-16T22:00:00.000Z'),
        requestedOutTime: new Date('2026-10-17T06:00:00.000Z'),
        reason: 'Biometric device offline due to power cut',
        status: 'PENDING',
      },
    });
    assert.strictEqual(reg.status, 'PENDING');
  });

  // 7. LeaveType, LeavePolicy, LeaveBalance & LeaveRequest
  await test('7. Leave management: types, policies, balances & partial/multi-day requests', async () => {
    const leaveType = await prisma.leaveType.create({
      data: {
        companyId,
        name: 'Paid Leave',
        code: `PL_${nonce}`,
        isPaid: true,
        allowHalfDay: true,
      },
    });

    const policy = await prisma.leavePolicy.create({
      data: {
        companyId,
        leaveTypeId: leaveType.id,
        annualQuota: new Decimal(18.00),
        accrualFrequency: 'MONTHLY',
        effectiveFrom: new Date('2026-01-01'),
      },
    });
    assert.strictEqual(Number(policy.annualQuota), 18);

    const balance = await prisma.employeeLeaveBalance.create({
      data: {
        companyId,
        employeeProfileId: profile.id,
        leaveTypeId: leaveType.id,
        year: 2026,
        openingBalance: new Decimal(10.00),
        accrued: new Decimal(6.00),
        used: new Decimal(2.00),
        currentBalance: new Decimal(14.00),
      },
    });
    assert.strictEqual(Number(balance.currentBalance), 14);

    // Half-day leave request
    const halfDayLeave = await prisma.leaveRequest.create({
      data: {
        companyId,
        employeeProfileId: profile.id,
        leaveTypeId: leaveType.id,
        startDate: new Date('2026-10-20'),
        endDate: new Date('2026-10-20'),
        isHalfDay: true,
        halfDaySession: 'FIRST_HALF',
        daysCount: new Decimal(0.50),
        reason: 'Personal appointment',
        status: 'PENDING',
      },
    });
    assert.strictEqual(Number(halfDayLeave.daysCount), 0.5);
  });

  // 8. BiometricDevice & BiometricPunchLog
  await test('8. Biometric hardware registry & raw punch log decoupling', async () => {
    const device = await prisma.biometricDevice.create({
      data: {
        companyId,
        deviceName: 'Plant Gate Terminal 1',
        deviceSerial: `ZKT-SN-${nonce}`,
        deviceModel: 'ZKTeco uFace 800',
        ipAddress: '192.168.1.101',
        port: 4370,
        status: 'ONLINE',
      },
    });

    const punch = await prisma.biometricPunchLog.create({
      data: {
        companyId,
        deviceId: device.id,
        employeeProfileId: profile.id,
        biometricUserId: `BIO-${nonce}`,
        punchTime: new Date(),
        punchType: 'CHECK_IN',
        isProcessed: false,
      },
    });
    assert.strictEqual(punch.isProcessed, false);
  });

  // 9. SalaryComponent, SalaryStructure & EmployeeSalaryAssignment
  let structure;
  await test('9. Compensation: Components, structure templates & effective-dated assignments', async () => {
    const basicComp = await prisma.salaryComponent.create({
      data: {
        companyId,
        name: 'Basic Pay',
        code: `BASIC_${nonce}`,
        type: 'EARNING',
        calculationType: 'PERCENTAGE_OF_GROSS',
        isTaxable: true,
      },
    });

    structure = await prisma.salaryStructure.create({
      data: {
        companyId,
        name: 'Standard Engineering Staff',
        code: `ENG_CTC_${nonce}`,
        componentsJson: [
          { componentCode: 'BASIC', percentage: 50 },
          { componentCode: 'HRA', percentage: 20 },
          { componentCode: 'SPECIAL_ALLOW', percentage: 30 },
        ],
      },
    });

    const assignment = await prisma.employeeSalaryAssignment.create({
      data: {
        companyId,
        employeeProfileId: profile.id,
        salaryStructureId: structure.id,
        ctcAnnual: new Decimal(600000.00),
        ctcMonthly: new Decimal(50000.00),
        effectiveFrom: new Date('2026-04-01'),
        componentsBreakdown: {
          basic: 25000,
          hra: 10000,
          specialAllowance: 15000,
        },
      },
    });
    assert.strictEqual(Number(assignment.ctcMonthly), 50000);
  });

  // 10. PayrollBatch, PayrollItem & JournalVoucher Linkage
  let payrollBatch;
  await test('10. Monthly PayrollBatch with Phase 8 JournalVoucher linkage & PayrollItem calculation', async () => {
    // Phase 8 JournalVoucher
    const jv = await prisma.journalVoucher.create({
      data: {
        companyId,
        voucherNo: `JV-SAL-${nonce}`,
        voucherType: 'PAYROLL',
        narration: 'Salary Disbursement Batch',
        totalDebit: new Decimal(50000.00),
        totalCredit: new Decimal(50000.00),
        status: 'POSTED',
      },
    });

    payrollBatch = await prisma.payrollBatch.create({
      data: {
        companyId,
        batchNumber: `PAY-BATCH-${nonce}`,
        month: 10,
        year: 2026,
        periodStartDate: new Date('2026-10-01'),
        periodEndDate: new Date('2026-10-31'),
        totalEmployees: 1,
        totalGross: new Decimal(50000.00),
        totalDeductions: new Decimal(3500.00),
        totalNet: new Decimal(46500.00),
        status: 'APPROVED',
        voucherId: jv.id, // Explicit foreign key link to JournalVoucher
      },
    });
    assert.ok(payrollBatch.voucherId);

    const item = await prisma.payrollItem.create({
      data: {
        companyId,
        payrollBatchId: payrollBatch.id,
        employeeProfileId: profile.id,
        workingDays: new Decimal(31.00),
        paidDays: new Decimal(31.00),
        lopDays: new Decimal(0.00),
        grossEarned: new Decimal(50000.00),
        totalDeductions: new Decimal(3500.00),
        netPayable: new Decimal(46500.00),
        earningsBreakdown: { basic: 25000, hra: 10000, specialAllowance: 15000 },
        deductionsBreakdown: { pf: 1800, pt: 200, tds: 1500 },
      },
    });
    assert.strictEqual(Number(item.netPayable), 46500);

    // 11. EmployeePayslip
    const payslip = await prisma.employeePayslip.create({
      data: {
        companyId,
        payrollItemId: item.id,
        employeeProfileId: profile.id,
        payslipNumber: `PSL-202610-${nonce}`,
        month: 10,
        year: 2026,
        grossAmount: new Decimal(50000.00),
        deductionsAmount: new Decimal(3500.00),
        netAmount: new Decimal(46500.00),
        netAmountInWords: 'Forty-Six Thousand Five Hundred Rupees Only',
        snapshotJson: {
          employeeName: 'Sunil Sharma',
          employeeCode: `EMP-${nonce}`,
          netAmount: 46500,
          earnings: { basic: 25000, hra: 10000, specialAllowance: 15000 },
          deductions: { pf: 1800, pt: 200, tds: 1500 },
        },
        downloadToken: `tok_${nonce}_${Date.now()}`,
        isPublished: true,
      },
    });
    assert.ok(payslip.downloadToken);
  });

  // 12. StatutoryRule (Configurable & Effective-Dated)
  await test('11. StatutoryRule configurable parameters for EPF, ESIC, PT, TDS', async () => {
    const pfRule = await prisma.statutoryRule.create({
      data: {
        companyId,
        ruleType: 'EPF',
        effectiveFrom: new Date('2026-04-01'),
        configJson: {
          employeeContributionRate: 12.0,
          employerEpContributionRate: 3.67,
          employerEpsContributionRate: 8.33,
          wageCeiling: 15000,
        },
      },
    });
    assert.strictEqual(pfRule.ruleType, 'EPF');

    const ptRule = await prisma.statutoryRule.create({
      data: {
        companyId,
        ruleType: 'PROFESSIONAL_TAX',
        effectiveFrom: new Date('2026-04-01'),
        configJson: {
          state: 'MAHARASHTRA',
          slabs: [
            { min: 0, max: 7500, tax: 0 },
            { min: 7501, max: 10000, tax: 175 },
            { min: 10001, max: null, tax: 200, februaryTax: 300 },
          ],
        },
      },
    });
    assert.strictEqual(ptRule.ruleType, 'PROFESSIONAL_TAX');
  });

  // 13. Tenant Isolation
  await test('12. Strict multi-tenant isolation across companies', async () => {
    const company2 = await prisma.clientAdmin.create({
      data: {
        name: `Other Co ${nonce}`,
        email: `other_${nonce}@testcorp.com`,
        organizationName: `Other Corp ${nonce}`,
        passwordHash: 'dummyhash',
      },
    });

    const otherProfile = await prisma.employeeProfile.findFirst({
      where: { companyId: company2.id, employeeCode: `EMP-${nonce}` },
    });
    assert.strictEqual(otherProfile, null, 'Employee profile must not leak across companies');
  });

  console.log('\n========================================================================');
  console.log(`   ALL ${passedCount} PHASE 9 SCHEMA TESTS PASSED SUCCESSFULLY!       `);
  console.log('========================================================================\n');

  await prisma.$disconnect();
}

runPhase9SchemaVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 9 schema verification failed:', err);
    process.exit(1);
  });

