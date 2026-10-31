import prisma from '../config/prisma.js';
import { auditService } from './audit.service.js';

function versionError(message, statusCode = 400, code = 'VERSION_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export const versionService = {
  /**
   * Create the initial V1 version for a document with complete snapshot
   */
  async createInitialVersion(companyIdOrOptions, entityTypeArg, entityIdArg, payloadArg, currentUserArg) {
    let companyId, entityType, entityId, payload, currentUser;

    if (typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null) {
      companyId = companyIdOrOptions.companyId;
      entityType = companyIdOrOptions.entityType;
      entityId = companyIdOrOptions.entityId;
      payload = companyIdOrOptions.snapshotData || companyIdOrOptions.payload || {};
      currentUser = {
        userId: companyIdOrOptions.createdById || companyIdOrOptions.userId,
        name: companyIdOrOptions.createdByName || companyIdOrOptions.userName,
        role: companyIdOrOptions.role || 'COMPANY_ADMIN',
      };
    } else {
      companyId = companyIdOrOptions;
      entityType = entityTypeArg;
      entityId = entityIdArg;
      payload = payloadArg;
      currentUser = currentUserArg || {};
    }

    const createdById = String(currentUser.userId || currentUser.id || 'user');
    const createdByName = currentUser.name || currentUser.organizationName || 'User';

    const existing = await prisma.documentVersion.findFirst({
      where: { companyId, entityType, entityId, versionNumber: 1 },
    });

    if (existing) {
      return existing;
    }

    const version = await prisma.documentVersion.create({
      data: {
        companyId,
        entityType,
        entityId,
        versionNumber: 1,
        parentVersionId: null,
        revisionReason: 'Initial Document Creation',
        isLocked: false,
        createdById,
        createdByName,
        snapshotData: payload,
      },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'CREATE_VERSION',
      entityType: 'DOCUMENT_VERSION',
      entityId: version.id,
      afterState: { entityType, entityId, versionNumber: 1 },
      reason: 'Created initial V1 snapshot',
    });

    return version;
  },

  /**
   * Check if the latest version of an entity is approved & locked
   */
  async isDocumentLocked(companyId, entityType, entityId) {
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { companyId, entityType, entityId },
      orderBy: { versionNumber: 'desc' },
    });

    return Boolean(latestVersion?.isLocked);
  },

  /**
   * Lock a document version upon approval (making it permanently immutable)
   */
  async lockVersion(companyId, entityType, entityId, versionNumber, currentUser) {
    const user = typeof currentUser === 'string'
      ? { userId: currentUser, name: 'Approver' }
      : (currentUser || {});

    const version = await prisma.documentVersion.findFirst({
      where: { companyId, entityType, entityId, versionNumber: Number(versionNumber) },
    });

    if (!version) {
      throw versionError(`Document version V${versionNumber} not found.`, 404);
    }

    const locked = await prisma.documentVersion.update({
      where: { id: version.id },
      data: {
        isLocked: true,
        lockedAt: new Date(),
      },
    });

    await auditService.logAction({
      companyId,
      actor: user,
      action: 'LOCK_VERSION',
      entityType: 'DOCUMENT_VERSION',
      entityId: locked.id,
      afterState: { entityType, entityId, versionNumber, isLocked: true },
      reason: `Locked V${versionNumber} permanently upon approval`,
    });

    return locked;
  },

  /**
   * Branch a new revision (V2, V3...) preserving parent history and requiring a reason
   */
  async branchNewVersion(companyIdOrOptions, entityTypeArg, entityIdArg, newPayloadArg, revisionReasonArg, currentUserArg) {
    let companyId, entityType, entityId, newPayload, revisionReason, currentUser;

    if (typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null) {
      companyId = companyIdOrOptions.companyId;
      entityType = companyIdOrOptions.entityType;
      entityId = companyIdOrOptions.entityId;
      newPayload = companyIdOrOptions.newSnapshotData || companyIdOrOptions.snapshotData || {};
      revisionReason = companyIdOrOptions.revisionReason;
      currentUser = {
        userId: companyIdOrOptions.createdById || companyIdOrOptions.userId,
        name: companyIdOrOptions.createdByName || companyIdOrOptions.userName,
        role: companyIdOrOptions.role || 'COMPANY_ADMIN',
      };
    } else {
      companyId = companyIdOrOptions;
      entityType = entityTypeArg;
      entityId = entityIdArg;
      newPayload = newPayloadArg;
      revisionReason = revisionReasonArg;
      currentUser = currentUserArg || {};
    }

    if (!revisionReason || !revisionReason.trim()) {
      throw versionError('A valid revision reason is required to branch a new version.');
    }

    const latest = await prisma.documentVersion.findFirst({
      where: { companyId, entityType, entityId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;
    const parentVersionId = latest ? latest.id : null;
    const createdById = String(currentUser.userId || currentUser.id || 'user');
    const createdByName = currentUser.name || currentUser.organizationName || 'User';

    const newVersion = await prisma.documentVersion.create({
      data: {
        companyId,
        entityType,
        entityId,
        versionNumber: nextVersionNumber,
        parentVersionId,
        revisionReason: revisionReason.trim(),
        isLocked: false,
        createdById,
        createdByName,
        snapshotData: newPayload,
      },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'BRANCH_VERSION',
      entityType: 'DOCUMENT_VERSION',
      entityId: newVersion.id,
      afterState: { entityType, entityId, versionNumber: nextVersionNumber, parentVersionId, revisionReason },
      reason: `Branched new revision V${nextVersionNumber}`,
    });

    return newVersion;
  },

  /**
   * Convenience alias for branchNewVersion
   */
  async branchVersion(options) {
    return this.branchNewVersion(options);
  },

  /**
   * Retrieve all historical versions for an entity
   */
  async getVersionHistory(companyId, entityType, entityId) {
    return prisma.documentVersion.findMany({
      where: { companyId, entityType, entityId },
      orderBy: { versionNumber: 'asc' },
    });
  },

  /**
   * Retrieve a specific version snapshot
   */
  async getSpecificVersion(companyId, entityType, entityId, versionNumber) {
    const version = await prisma.documentVersion.findFirst({
      where: {
        companyId,
        entityType,
        entityId,
        versionNumber: Number(versionNumber),
      },
    });

    if (!version) {
      throw versionError(`Version V${versionNumber} for ${entityType} #${entityId} not found.`, 404);
    }

    return version;
  },
};

export default versionService;
