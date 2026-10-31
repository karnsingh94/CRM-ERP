import prisma from '../config/prisma.js';
import { notificationService } from './notification.service.js';
import { auditService } from './audit.service.js';

function approvalError(message, statusCode = 400, code = 'APPROVAL_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export const approvalService = {
  /**
   * Create a new approval request for any ERP entity
   */
  async createRequest(companyIdOrOptions, data = {}, currentUser = {}) {
    let companyId, payload, user;

    if (typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null) {
      companyId = companyIdOrOptions.companyId;
      payload = {
        entityType: companyIdOrOptions.entityType,
        entityId: companyIdOrOptions.entityId,
        title: companyIdOrOptions.title || `${companyIdOrOptions.entityType} #${companyIdOrOptions.entityId}`,
        summary: companyIdOrOptions.summary,
        amount: companyIdOrOptions.amount || companyIdOrOptions.metadata?.totalAmount,
        documentVersionId: companyIdOrOptions.documentVersionId,
        currentApproverRole: companyIdOrOptions.currentApproverRole || 'MANAGER',
        currentApproverId: companyIdOrOptions.currentApproverId,
        maxLevels: companyIdOrOptions.totalLevels || companyIdOrOptions.maxLevels || 1,
      };
      user = {
        userId: companyIdOrOptions.creatorId || companyIdOrOptions.userId,
        name: companyIdOrOptions.creatorName || companyIdOrOptions.userName,
        role: companyIdOrOptions.role || 'COMPANY_ADMIN',
      };
    } else {
      companyId = companyIdOrOptions;
      payload = data;
      user = currentUser;
    }

    const {
      entityType,
      entityId,
      documentVersionId,
      title,
      summary,
      amount,
      currentApproverRole = 'MANAGER',
      currentApproverId = null,
      maxLevels = 1,
    } = payload;

    if (!entityType || !entityId || !title) {
      throw approvalError('entityType, entityId, and title are required fields.');
    }

    // Check if there is already an active PENDING request for this entity
    const existing = await prisma.approvalRequest.findFirst({
      where: {
        companyId,
        entityType,
        entityId,
        status: 'PENDING',
      },
    });

    if (existing) {
      throw approvalError('An active pending approval request already exists for this entity.', 409, 'DUPLICATE_PENDING_APPROVAL');
    }

    const createdById = user.userId || user.id;
    const createdByName = user.name || user.organizationName || 'User';

    const request = await prisma.approvalRequest.create({
      data: {
        companyId,
        entityType,
        entityId,
        documentVersionId: documentVersionId || null,
        createdById: String(createdById),
        createdByName,
        currentApproverRole,
        currentApproverId: currentApproverId ? String(currentApproverId) : null,
        approvalLevel: 1,
        maxLevels: Number(maxLevels) || 1,
        status: 'PENDING',
        title: title.trim(),
        summary: summary ? summary.trim() : null,
        amount: amount !== undefined && amount !== null ? Number(amount) : null,
      },
    });

    // Notify approver or company managers
    await notificationService.createNotification({
      companyId,
      recipientId: currentApproverId ? String(currentApproverId) : 'MANAGERS',
      title: `Approval Required: ${title}`,
      message: `${createdByName} submitted ${entityType} #${entityId} for approval.`,
      category: 'APPROVAL',
      entityType,
      entityId,
    });

    // Audit log
    await auditService.logAction({
      companyId,
      actor: user,
      action: 'SUBMIT_APPROVAL',
      entityType: 'APPROVAL_REQUEST',
      entityId: request.id,
      afterState: { id: request.id, entityType, entityId, title, status: 'PENDING' },
      reason: 'Submitted for approval',
    });

    return request;
  },

  /**
   * Convenience alias for createRequest
   */
  async submitApprovalRequest(options) {
    return this.createRequest(options);
  },

  /**
   * Record an approval or rejection decision with strict Segregation of Duties (SoD)
   */
  async recordDecision(companyIdOrOptions, requestIdArg, decisionDataArg, currentUserArg) {
    let companyId, requestId, decisionData, currentUser;

    if (typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null) {
      companyId = companyIdOrOptions.companyId;
      requestId = companyIdOrOptions.requestId;
      decisionData = {
        decision: companyIdOrOptions.decision,
        remarks: companyIdOrOptions.remarks,
      };
      currentUser = {
        userId: companyIdOrOptions.approverId || companyIdOrOptions.userId,
        name: companyIdOrOptions.approverName || companyIdOrOptions.userName,
        role: companyIdOrOptions.approverRole || companyIdOrOptions.role || 'COMPANY_ADMIN',
      };
    } else {
      companyId = companyIdOrOptions;
      requestId = requestIdArg;
      decisionData = decisionDataArg;
      currentUser = currentUserArg;
    }

    const { decision, remarks } = decisionData; // decision: 'APPROVED' | 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      throw approvalError('Decision must be either APPROVED or REJECTED.');
    }

    const request = await prisma.approvalRequest.findFirst({
      where: { id: requestId, companyId },
      include: { decisions: true },
    });

    if (!request) {
      throw approvalError('Approval request not found.', 404, 'APPROVAL_NOT_FOUND');
    }

    if (request.status !== 'PENDING') {
      throw approvalError(`Cannot record decision on an approval request that is already ${request.status}.`, 409, 'APPROVAL_ALREADY_RESOLVED');
    }

    const currentUserId = String(currentUser.userId || currentUser.id);
    const currentUserName = currentUser.name || currentUser.organizationName || 'Approver';
    const currentUserRole = currentUser.role || 'COMPANY_ADMIN';

    // Segregation of Duties (SoD) validation:
    // A document creator cannot approve their own submission unless configured otherwise.
    if (String(request.createdById) === currentUserId && decision === 'APPROVED') {
      throw approvalError(
        'Segregation of Duties Violation: You cannot approve your own submission.',
        403,
        'FORBIDDEN_SELF_APPROVAL_PROHIBITED'
      );
    }

    // Role-level authorization check
    if (currentUserRole !== 'COMPANY_ADMIN') {
      if (request.currentApproverId && request.currentApproverId !== currentUserId) {
        throw approvalError('You are not the designated approver for this request.', 403, 'FORBIDDEN_UNAUTHORIZED_APPROVER');
      }
    }

    const newLevel = request.approvalLevel;
    let nextStatus = 'PENDING';

    if (decision === 'REJECTED') {
      nextStatus = 'REJECTED';
    } else if (decision === 'APPROVED') {
      if (request.approvalLevel >= request.maxLevels) {
        nextStatus = 'APPROVED';
      } else {
        // Multi-level approval: increment level
        nextStatus = 'PENDING';
      }
    }

    // Atomic transaction for decision and status update
    const result = await prisma.$transaction(async (tx) => {
      const recordedDecision = await tx.approvalDecision.create({
        data: {
          requestId: request.id,
          approverId: currentUserId,
          approverName: currentUserName,
          approverRole: currentUserRole,
          level: newLevel,
          decision,
          remarks: remarks ? remarks.trim() : null,
        },
      });

      const updatedRequest = await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          approvalLevel: decision === 'APPROVED' && nextStatus === 'PENDING' ? newLevel + 1 : newLevel,
        },
        include: { decisions: true },
      });

      return { recordedDecision, updatedRequest };
    });

    // Notify the original creator
    await notificationService.createNotification({
      companyId,
      recipientId: request.createdById,
      title: `Approval Request ${decision}: ${request.title}`,
      message: `${currentUserName} (${currentUserRole}) recorded decision: ${decision}${remarks ? ` — "${remarks}"` : ''}`,
      category: 'APPROVAL',
      entityType: request.entityType,
      entityId: request.entityId,
    });

    // If final level approved, lock document version if linked
    if (nextStatus === 'APPROVED' && request.documentVersionId) {
      await prisma.documentVersion.updateMany({
        where: { id: request.documentVersionId, companyId },
        data: { isLocked: true, lockedAt: new Date() },
      });
    }

    // Audit log
    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: `RECORD_${decision}`,
      entityType: 'APPROVAL_REQUEST',
      entityId: request.id,
      afterState: { requestId: request.id, decision, remarks, newStatus: nextStatus },
      reason: `Recorded approval decision: ${decision}`,
    });

    return {
      ...result.updatedRequest,
      recordedDecision: result.recordedDecision,
      updatedRequest: result.updatedRequest,
      currentLevel: result.updatedRequest.approvalLevel,
    };
  },

  /**
   * List approval requests for a company
   */
  async listRequests(companyId, filters = {}) {
    const { status, entityType, createdById, currentApproverId, limit = 50, offset = 0 } = filters;
    const where = { companyId };

    if (status) where.status = status;
    if (entityType) where.entityType = entityType;
    if (createdById) where.createdById = String(createdById);
    if (currentApproverId) where.currentApproverId = String(currentApproverId);

    const [items, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        include: {
          decisions: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit) || 50,
        skip: Number(offset) || 0,
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Get single approval request by ID
   */
  async getRequestById(companyId, requestId) {
    const request = await prisma.approvalRequest.findFirst({
      where: { id: requestId, companyId },
      include: {
        decisions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!request) {
      throw approvalError('Approval request not found.', 404, 'APPROVAL_NOT_FOUND');
    }

    return request;
  },
};

export default approvalService;
