import prisma from '../../src/config/prisma.js';
import approvalService from '../../src/services/approval.service.js';
import versionService from '../../src/services/version.service.js';
import attachmentService from '../../src/services/attachment.service.js';
import notificationService from '../../src/services/notification.service.js';
import integrationJobService from '../../src/services/integrationJob.service.js';
import auditService from '../../src/services/audit.service.js';
import { requireAction } from '../../src/middlewares/actionPermission.middleware.js';

export async function runPhase1SharedControlTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 1: Shared Control Layer Integration Test Suite');
  console.log('Testing: Approvals, SoD, Versioning, Attachments, Notifications, Jobs, Audit');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // Retrieve an active company tenant for testing
  const client = await prisma.clientAdmin.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (!client) {
    throw new Error('No active ClientAdmin found in database to execute Phase 1 test suite.');
  }

  const companyId = client.id;
  const otherCompanyId = '00000000-0000-0000-0000-000000000099';
  const creatorId = 'user-creator-101';
  const approver1Id = 'user-approver-201';
  const approver2Id = 'user-approver-202';
  const testDocId = `doc-test-${Date.now()}`;

  // 1. Multi-Tenant Isolation: Notifications
  await test('1. Multi-tenant isolation for Phase 1 models', async () => {
    const notif = await notificationService.createNotification({
      companyId,
      recipientId: creatorId,
      category: 'SYSTEM',
      title: 'Tenant Isolation Test',
      message: 'Checking tenant boundary',
    });

    if (!notif) throw new Error('Failed to create notification');

    const tenantList = await notificationService.getUserNotifications(companyId, creatorId);
    const found = tenantList.items.some((n) => n.id === notif.id);
    if (!found) throw new Error('Notification not found under correct company tenant');

    const otherTenantList = await notificationService.getUserNotifications(otherCompanyId, creatorId);
    const leaked = otherTenantList.items.some((n) => n.id === notif.id);
    if (leaked) throw new Error('Security Breach: Notification leaked to other company tenant');
  });

  // 2. Segregation of Duties (SoD): Creator Self-Approval Prevention
  let activeRequestId = null;
  await test('2. Segregation of Duties: Creator cannot approve their own request', async () => {
    const req = await approvalService.submitApprovalRequest({
      companyId,
      entityType: 'SALES_QUOTATION',
      entityId: testDocId,
      title: `Sales Quote #${testDocId}`,
      creatorId,
      creatorName: 'Sales Rep Alice',
      totalLevels: 2,
      metadata: { totalAmount: 150000, currency: 'INR' },
    });
    activeRequestId = req.id;

    // Creator Alice tries to approve her own request -> Must throw SoD error
    let threwSoD = false;
    try {
      await approvalService.recordDecision({
        companyId,
        requestId: activeRequestId,
        approverId: creatorId, // Alice
        approverName: 'Sales Rep Alice',
        decision: 'APPROVED',
        remarks: 'Self approving',
      });
    } catch (err) {
      if (err.message.includes('Segregation of Duties') || err.statusCode === 403 || err.code === 'FORBIDDEN_SELF_APPROVAL_PROHIBITED') {
        threwSoD = true;
      } else {
        throw err;
      }
    }

    if (!threwSoD) {
      throw new Error('Expected SoD violation error when creator attempts self-approval, but none was thrown');
    }
  });

  // 3. Multi-Level Approval Sequence Progression
  await test('3. Multi-level approval sequence progression', async () => {
    // Level 1 Approval by Approver 1 (Manager)
    const level1Result = await approvalService.recordDecision({
      companyId,
      requestId: activeRequestId,
      approverId: approver1Id,
      approverName: 'Manager Bob',
      approverRole: 'COMPANY_ADMIN',
      decision: 'APPROVED',
      remarks: 'Level 1 verified and approved',
    });

    if (level1Result.status !== 'PENDING') {
      throw new Error(`Expected status to remain PENDING after Level 1 of 2, got: ${level1Result.status}`);
    }
    if (level1Result.currentLevel !== 2) {
      throw new Error(`Expected currentLevel to advance to 2, got: ${level1Result.currentLevel}`);
    }

    // Level 2 Approval by Approver 2 (Director)
    const level2Result = await approvalService.recordDecision({
      companyId,
      requestId: activeRequestId,
      approverId: approver2Id,
      approverName: 'Director Charlie',
      approverRole: 'COMPANY_ADMIN',
      decision: 'APPROVED',
      remarks: 'Final Level 2 authorization approved',
    });

    if (level2Result.status !== 'APPROVED') {
      throw new Error(`Expected status to become APPROVED after final level, got: ${level2Result.status}`);
    }
  });

  // 4. Rejection Handling
  await test('4. Approval rejection terminates workflow and notifies creator', async () => {
    const rejectDocId = `doc-rej-${Date.now()}`;
    const req = await approvalService.submitApprovalRequest({
      companyId,
      entityType: 'PURCHASE_ORDER',
      entityId: rejectDocId,
      title: `Purchase Order #${rejectDocId}`,
      creatorId,
      creatorName: 'Buyer Dave',
      totalLevels: 1,
    });

    const rejectedResult = await approvalService.recordDecision({
      companyId,
      requestId: req.id,
      approverId: approver1Id,
      approverName: 'Finance Head Eve',
      approverRole: 'COMPANY_ADMIN',
      decision: 'REJECTED',
      remarks: 'Exceeds budget allowance without justification',
    });

    if (rejectedResult.status !== 'REJECTED') {
      throw new Error(`Expected status REJECTED, got: ${rejectedResult.status}`);
    }

    // Attempting further decisions on rejected request must fail
    let cannotReapprove = false;
    try {
      await approvalService.recordDecision({
        companyId,
        requestId: req.id,
        approverId: approver2Id,
        approverName: 'Director Charlie',
        approverRole: 'COMPANY_ADMIN',
        decision: 'APPROVED',
        remarks: 'Trying to approve closed request',
      });
    } catch {
      cannotReapprove = true;
    }
    if (!cannotReapprove) {
      throw new Error('Should not allow further decisions on an already rejected request');
    }
  });

  // 5. Document Versioning, Immutability & Branching
  let initialV1 = null;
  await test('5. Document versioning: Initial snapshot and immutability lock', async () => {
    initialV1 = await versionService.createInitialVersion({
      companyId,
      entityType: 'SALES_QUOTATION',
      entityId: testDocId,
      snapshotData: { quoteNumber: 'QT-2026-001', items: [{ sku: 'SILK-01', qty: 100, price: 1500 }] },
      createdById: creatorId,
      createdByName: 'Sales Rep Alice',
    });

    if (initialV1.versionNumber !== 1) {
      throw new Error(`Expected versionNumber 1, got ${initialV1.versionNumber}`);
    }

    // Lock upon final approval
    const locked = await versionService.lockVersion(companyId, 'SALES_QUOTATION', testDocId, 1, {
      userId: approver2Id,
      name: 'Director Charlie',
    });

    if (!locked.isLocked) {
      throw new Error('Expected version 1 to be locked');
    }

    // Check locking check
    const isLocked = await versionService.isDocumentLocked(companyId, 'SALES_QUOTATION', testDocId);
    if (!isLocked) {
      throw new Error('isDocumentLocked returned false for an approved and locked document');
    }
  });

  await test('6. Document version branching (V1 -> V2) with revision reason', async () => {
    const v2 = await versionService.branchVersion({
      companyId,
      entityType: 'SALES_QUOTATION',
      entityId: testDocId,
      newSnapshotData: { quoteNumber: 'QT-2026-001', items: [{ sku: 'SILK-01', qty: 120, price: 1450 }] },
      revisionReason: 'Client negotiated volume discount: 120 units @ 1450',
      createdById: creatorId,
      createdByName: 'Sales Rep Alice',
    });

    if (v2.versionNumber !== 2) {
      throw new Error(`Expected versionNumber 2, got ${v2.versionNumber}`);
    }
    if (v2.parentVersionId !== initialV1.id) {
      throw new Error('Parent version link mismatch on branched revision');
    }
    if (v2.isLocked) {
      throw new Error('New branched version V2 should be open/unlocked for editing');
    }

    const history = await versionService.getVersionHistory(companyId, 'SALES_QUOTATION', testDocId);
    if (history.length !== 2) {
      throw new Error(`Expected 2 versions in history, got ${history.length}`);
    }
  });

  // 7. Universal Attachment Storage & SHA-256 Checksum
  let uploadedAttachment = null;
  await test('7. Universal attachment upload with SHA-256 and MIME validation', async () => {
    const dummyBuffer = Buffer.from('%PDF-1.4 Mock PDF Content For Phase 1 Verification ' + Date.now(), 'utf-8');
    const mockFile = {
      originalname: 'quote_signed_spec.pdf',
      mimetype: 'application/pdf',
      size: dummyBuffer.length,
      buffer: dummyBuffer,
    };

    uploadedAttachment = await attachmentService.uploadAttachment({
      companyId,
      entityType: 'SALES_QUOTATION',
      entityId: testDocId,
      file: mockFile,
      uploadedById: creatorId,
      uploadedByName: 'Sales Rep Alice',
    });

    if (!uploadedAttachment.checksumSha256 || uploadedAttachment.checksumSha256.length !== 64) {
      throw new Error('Invalid or missing SHA-256 checksum');
    }
    if (uploadedAttachment.mimeType !== 'application/pdf') {
      throw new Error(`Unexpected mimeType: ${uploadedAttachment.mimeType}`);
    }

    // Verify authorized retrieval
    const retrieved = await attachmentService.getAttachmentForDownload(companyId, uploadedAttachment.id);
    if (retrieved.attachment.id !== uploadedAttachment.id) {
      throw new Error('Retrieved attachment ID does not match uploaded record');
    }

    // Cross-tenant download attempt must fail
    let crossTenantBlocked = false;
    try {
      await attachmentService.getAttachmentForDownload(otherCompanyId, uploadedAttachment.id);
    } catch {
      crossTenantBlocked = true;
    }
    if (!crossTenantBlocked) {
      throw new Error('Cross-tenant attachment access was not blocked');
    }
  });

  // 8. Action-Level Permission Middleware
  await test('8. Action-level permission middleware enforcement', async () => {
    const middleware = requireAction('APPROVE');

    // Scenario A: Authorized Company Admin
    let nextCalled = false;
    const reqAllowed = {
      user: {
        role: 'COMPANY_ADMIN',
        userId: 'admin-1',
        companyId,
      },
    };
    const resAllowed = { status: () => resAllowed, json: () => {} };
    await middleware(reqAllowed, resAllowed, () => { nextCalled = true; });

    if (!nextCalled) {
      throw new Error('requireAction did not call next() for authorized company admin');
    }

    // Scenario B: Unauthenticated request (user is null)
    let unauth401 = false;
    const reqUnauth = { user: null };
    const resUnauth = {
      status: (code) => {
        if (code === 401) unauth401 = true;
        return resUnauth;
      },
      json: () => {},
    };
    await middleware(reqUnauth, resUnauth, () => {});

    if (!unauth401) {
      throw new Error('requireAction did not return 401 for unauthenticated request');
    }
  });

  // 9. Integration Job Framework: Idempotency & Stuck Recovery
  await test('9. Integration job idempotency deduplication and stuck job recovery', async () => {
    const idempotencyKey = `job-sync-${Date.now()}`;
    const res1 = await integrationJobService.enqueueJob({
      companyId,
      jobType: 'EXPORT_PACKING_LIST_SYNC',
      payload: { exportOrderNo: 'EXP-9002' },
      idempotencyKey,
    });

    // Re-enqueuing with exact same idempotencyKey should return existing job without duplicating
    const res2 = await integrationJobService.enqueueJob({
      companyId,
      jobType: 'EXPORT_PACKING_LIST_SYNC',
      payload: { exportOrderNo: 'EXP-9002' },
      idempotencyKey,
    });

    if (res1.job.id !== res2.job.id) {
      throw new Error('Idempotency violation: duplicate job was created for identical key');
    }
    if (!res2.isDuplicate) {
      throw new Error('Expected isDuplicate to be true for repeated idempotencyKey');
    }

    // Test stuck job recovery
    // Simulate a job stuck in PROCESSING from 10 minutes ago
    const stuckJob = await prisma.integrationJob.create({
      data: {
        companyId,
        jobType: 'STUCK_WORKER_SIMULATION',
        sourceSystem: 'INTERNAL',
        destinationSystem: 'EXTERNAL',
        idempotencyKey: `stuck-test-${Date.now()}`,
        payload: { test: true },
        status: 'PROCESSING',
        startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      },
    });

    const recoveredCount = await integrationJobService.recoverStuckJobs(5); // 5 min threshold
    if (recoveredCount < 1) {
      throw new Error('Failed to recover stuck processing job');
    }

    const checkRecovered = await prisma.integrationJob.findUnique({ where: { id: stuckJob.id } });
    if (checkRecovered.status !== 'RETRY_SCHEDULED') {
      throw new Error(`Expected stuck job status to become RETRY_SCHEDULED, got ${checkRecovered.status}`);
    }

    // Clean up test job
    await prisma.integrationJob.delete({ where: { id: stuckJob.id } });
  });

  // 10. Audit Logging with State Diffs and Secret Redaction
  await test('10. Audit logging: company-scoped logs and sensitive data redaction', async () => {
    await auditService.logAction({
      action: 'UPDATE_COMPANY_SETTINGS',
      actor: { userId: creatorId, name: 'Admin Dave', role: 'COMPANY_ADMIN' },
      target: 'CompanyConfig',
      details: 'Updated tenant credentials and webhook key',
      companyId,
      entityType: 'COMPANY_CONFIG',
      serviceCode: 'crm_sales',
      beforeState: { webhookKey: 'super-secret-key-12345', active: true, passwordHash: 'hash-abc' },
      afterState: { webhookKey: 'super-secret-key-99999', active: true, passwordHash: 'hash-xyz' },
    });

    const logs = await auditService.getCompanyAuditLogs(companyId, { limit: 1 });
    if (logs.items.length === 0) {
      throw new Error('Failed to retrieve company audit log entry');
    }

    const latest = logs.items[0];
    const rawBefore = typeof latest.beforeState === 'string' ? latest.beforeState : JSON.stringify(latest.beforeState);
    if (rawBefore.includes('super-secret-key-12345') || rawBefore.includes('hash-abc')) {
      throw new Error('Security Failure: Sensitive credentials were not redacted in audit log');
    }
    if (!rawBefore.includes('[REDACTED]')) {
      throw new Error('Expected [REDACTED] placeholder in sanitized audit log');
    }
  });

  // Clean up test attachment
  if (uploadedAttachment) {
    try {
      await attachmentService.deleteAttachment(companyId, uploadedAttachment.id);
    } catch {
      // Ignored
    }
  }

  console.log('\n========================================================================');
  console.log(`Phase 1 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed in Phase 1 integration suite.`);
  }
}

// Run if called directly
if (process.argv[1]?.endsWith('phase1_shared_control.test.js')) {
  runPhase1SharedControlTests()
    .then(() => {
      console.log('🎉 Phase 1 Shared Control Layer verification complete!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Test suite failure:', err);
      process.exit(1);
    });
}
