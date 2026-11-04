import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { attachmentService } from '../attachment.service.js';

function docError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const documentService = {
  /**
   * Upload an employee document into vault
   */
  async uploadDocument(companyId, employeeProfileId, data, file, actor = {}) {
    const { documentType, title, documentNumber, expiryDate } = data;
    if (!documentType || !title) {
      throw docError('documentType and title are required fields.');
    }

    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw docError('Employee profile not found.', 404);

    let attachmentId = null;
    let fileUrl = data.fileUrl || '/uploads/documents/placeholder.pdf';
    let fileName = file ? file.originalname : data.fileName || `${title.replace(/\s+/g, '_')}.pdf`;
    let fileSize = file ? file.size : data.fileSize || 0;
    let fileType = file ? file.mimetype : data.fileType || 'application/pdf';

    // If actual file buffer is supplied, upload via universal attachmentService
    if (file && file.buffer) {
      const att = await attachmentService.uploadAttachment({
        companyId,
        entityType: 'EMPLOYEE_DOCUMENT',
        entityId: employeeProfileId,
        file,
        uploadedById: actor.userId || actor.id,
        uploadedByName: actor.name || 'HR Admin',
        role: actor.role || 'COMPANY_ADMIN',
      });
      attachmentId = att.id;
      fileUrl = att.storageKey || att.filePath || fileUrl;
      fileName = att.originalName || fileName;
      fileSize = att.fileSize || fileSize;
      fileType = att.mimeType || fileType;
    }

    const doc = await prisma.employeeDocument.create({
      data: {
        companyId,
        employeeProfileId,
        documentType: documentType.trim().toUpperCase(),
        title: title.trim(),
        documentNumber: documentNumber ? documentNumber.trim() : null,
        fileUrl,
        fileName,
        fileSize,
        fileType,
        attachmentId,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isVerified: false,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'UPLOAD_EMPLOYEE_DOCUMENT',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: doc.id,
      afterState: { id: doc.id, title: doc.title, documentType: doc.documentType },
      reason: `Uploaded ${doc.documentType} document for employee ${profile.employeeCode}`,
    });

    return doc;
  },

  async listDocuments(companyId, employeeProfileId, filters = {}) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw docError('Employee profile not found.', 404);

    const { documentType, isVerified } = filters;
    const where = { companyId, employeeProfileId };
    if (documentType) where.documentType = documentType.toUpperCase();
    if (isVerified !== undefined) where.isVerified = isVerified === 'true' || isVerified === true;

    return prisma.employeeDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getDocumentById(companyId, documentId, actor = {}) {
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: documentId, companyId },
      include: {
        profile: {
          select: { id: true, employeeCode: true, displayName: true, employeeId: true },
        },
      },
    });
    if (!doc) throw docError('Document not found in vault.', 404);

    // Audit document access
    await auditService.logAction({
      companyId,
      actor,
      action: 'VIEW_EMPLOYEE_DOCUMENT',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: doc.id,
      details: { documentType: doc.documentType, title: doc.title },
      reason: 'Secure document view authorization',
    });

    return doc;
  },

  async verifyDocument(companyId, documentId, { isVerified, rejectionReason }, actor = {}) {
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: documentId, companyId },
    });
    if (!doc) throw docError('Document not found in vault.', 404);

    const verified = isVerified === true || isVerified === 'true';
    const now = new Date();
    const actorId = String(actor.userId || actor.id || 'admin');

    const updated = await prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        isVerified: verified,
        verifiedAt: verified ? now : null,
        verifiedById: verified ? actorId : null,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: verified ? 'VERIFY_EMPLOYEE_DOCUMENT' : 'REJECT_EMPLOYEE_DOCUMENT',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: doc.id,
      beforeState: { isVerified: doc.isVerified },
      afterState: { isVerified: verified },
      reason: rejectionReason || (verified ? 'Document verified by HR' : 'Document rejected'),
    });

    return updated;
  },

  async deleteDocument(companyId, documentId, actor = {}) {
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: documentId, companyId },
    });
    if (!doc) throw docError('Document not found in vault.', 404);

    await prisma.employeeDocument.delete({ where: { id: documentId } });

    await auditService.logAction({
      companyId,
      actor,
      action: 'DELETE_EMPLOYEE_DOCUMENT',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: documentId,
      reason: 'Deleted employee document from vault',
    });

    return { success: true };
  },

  async getExpiringDocuments(companyId, daysAhead = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + Number(daysAhead));

    return prisma.employeeDocument.findMany({
      where: {
        companyId,
        expiryDate: {
          not: null,
          lte: cutoff,
          gte: new Date(),
        },
      },
      include: {
        profile: {
          select: { id: true, employeeCode: true, displayName: true, workEmail: true },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });
  },
};

export default documentService;

