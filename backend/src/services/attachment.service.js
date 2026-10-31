import crypto from 'crypto';
import path from 'path';
import prisma from '../config/prisma.js';
import { defaultStorageProvider } from './storage.service.js';
import { auditService } from './audit.service.js';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

function attachmentError(message, statusCode = 400, code = 'ATTACHMENT_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export const attachmentService = {
  /**
   * Upload and persist an attachment for any ERP business entity
   */
  async uploadAttachment(companyIdOrOptions, entityTypeArg, entityIdArg, fileArg, currentUserArg) {
    let companyId, entityType, entityId, file, currentUser;

    if (typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null && companyIdOrOptions.file) {
      companyId = companyIdOrOptions.companyId;
      entityType = companyIdOrOptions.entityType;
      entityId = companyIdOrOptions.entityId;
      file = companyIdOrOptions.file;
      currentUser = {
        userId: companyIdOrOptions.uploadedById || companyIdOrOptions.userId,
        name: companyIdOrOptions.uploadedByName || companyIdOrOptions.userName,
        role: companyIdOrOptions.role || 'COMPANY_ADMIN',
      };
    } else {
      companyId = companyIdOrOptions;
      entityType = entityTypeArg;
      entityId = entityIdArg;
      file = fileArg;
      currentUser = currentUserArg || {};
    }

    if (!file || !file.buffer) {
      throw attachmentError('No file buffer provided for upload.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw attachmentError('File size exceeds the 15 MB limit.', 400, 'FILE_TOO_LARGE');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw attachmentError(
        `Unsupported file type "${file.mimetype}". Allowed types: PDF, JPEG, PNG, WebP, CSV, XLSX.`,
        400,
        'UNSUPPORTED_MEDIA_TYPE'
      );
    }

    // Compute SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Generate safe stored filename
    const ext = path.extname(file.originalname).toLowerCase();
    const safeStoredFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

    // Persist file via StorageProvider abstraction
    const storageKey = await defaultStorageProvider.saveFile(companyId, entityType, safeStoredFilename, file.buffer);

    const uploadedById = String(currentUser.userId || currentUser.id || 'user');
    const uploadedByName = currentUser.name || currentUser.organizationName || 'User';

    const attachment = await prisma.attachment.create({
      data: {
        companyId,
        entityType,
        entityId: String(entityId),
        originalName: file.originalname,
        storedName: safeStoredFilename,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileChecksum: checksum,
        storageKey,
        uploadedById,
        uploadedByName,
      },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'UPLOAD_ATTACHMENT',
      entityType: 'ATTACHMENT',
      entityId: attachment.id,
      afterState: {
        id: attachment.id,
        entityType,
        entityId,
        originalName: file.originalname,
        fileSize: file.size,
        checksumSha256: checksum,
      },
      reason: `Uploaded attachment for ${entityType} #${entityId}`,
    });

    return {
      ...attachment,
      checksumSha256: checksum,
      fileName: safeStoredFilename,
    };
  },

  /**
   * Retrieve an attachment and authorize download stream
   */
  async getAttachmentForDownload(companyId, attachmentId) {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        companyId,
      },
    });

    if (!attachment) {
      throw attachmentError('Attachment not found or access denied.', 404, 'ATTACHMENT_NOT_FOUND');
    }

    const stream = await defaultStorageProvider.getFileStream(attachment.storageKey);

    return {
      attachment: {
        ...attachment,
        checksumSha256: attachment.fileChecksum,
        fileName: attachment.storedName,
      },
      stream,
    };
  },

  /**
   * List attachments for an entity within tenant scope
   */
  async listAttachments(companyId, entityType, entityId) {
    const list = await prisma.attachment.findMany({
      where: {
        companyId,
        entityType,
        entityId: String(entityId),
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map(a => ({
      ...a,
      checksumSha256: a.fileChecksum,
      fileName: a.storedName,
    }));
  },

  /**
   * Delete an attachment
   */
  async deleteAttachment(companyId, attachmentId, currentUser = {}) {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        companyId,
      },
    });

    if (!attachment) {
      throw attachmentError('Attachment not found or access denied.', 404, 'ATTACHMENT_NOT_FOUND');
    }

    // Delete underlying physical file
    await defaultStorageProvider.deleteFile(attachment.storageKey);

    // Remove DB record
    await prisma.attachment.delete({
      where: { id: attachment.id },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'DELETE_ATTACHMENT',
      entityType: 'ATTACHMENT',
      entityId: attachment.id,
      beforeState: { originalName: attachment.originalName, storageKey: attachment.storageKey },
      reason: `Deleted attachment #${attachment.id}`,
    });

    return { success: true };
  },
};

export default attachmentService;
