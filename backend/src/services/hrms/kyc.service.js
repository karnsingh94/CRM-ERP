import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { approvalService } from '../approval.service.js';

function kycError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const kycService = {
  /**
   * Get employee KYC record
   */
  async getKycRecord(companyId, employeeProfileId) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw kycError('Employee profile not found.', 404);

    let kyc = await prisma.employeeKyc.findUnique({
      where: { employeeProfileId },
    });

    if (!kyc) {
      kyc = await prisma.employeeKyc.create({
        data: {
          companyId,
          employeeProfileId,
          overallStatus: 'PENDING',
        },
      });
    }

    return kyc;
  },

  /**
   * Maker-Checker field-level verification for PAN, Aadhaar, Bank Details
   */
  async verifyKycField(companyId, employeeProfileId, field, status, remarks = null, actor = {}) {
    const validFields = ['PAN', 'AADHAAR', 'BANK'];
    const normField = field.toUpperCase();
    if (!validFields.includes(normField)) {
      throw kycError(`Invalid verification field. Allowed: ${validFields.join(', ')}`);
    }

    const validStatuses = ['VERIFIED', 'REJECTED', 'PENDING'];
    const normStatus = status.toUpperCase();
    if (!validStatuses.includes(normStatus)) {
      throw kycError(`Invalid status. Allowed: ${validStatuses.join(', ')}`);
    }

    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw kycError('Employee profile not found.', 404);

    // Segregation of Duties: Employee cannot verify their own KYC
    const actorUserId = actor.userId || actor.id;
    if (profile.employeeId && actorUserId && String(profile.employeeId) === String(actorUserId)) {
      throw kycError('Segregation of Duties Violation: You cannot verify your own KYC credentials.', 403);
    }

    let kyc = await prisma.employeeKyc.findUnique({
      where: { employeeProfileId },
    });
    if (!kyc) {
      kyc = await prisma.employeeKyc.create({
        data: {
          companyId,
          employeeProfileId,
          overallStatus: 'PENDING',
        },
      });
    }

    const updateData = { notes: remarks ? remarks.trim() : kyc.notes };
    const now = new Date();

    if (normField === 'PAN') {
      updateData.panStatus = normStatus;
      updateData.panVerifiedAt = normStatus === 'VERIFIED' ? now : null;
      updateData.panVerifiedById = normStatus === 'VERIFIED' ? String(actorUserId || 'admin') : null;
    } else if (normField === 'AADHAAR') {
      updateData.aadhaarStatus = normStatus;
      updateData.aadhaarVerifiedAt = normStatus === 'VERIFIED' ? now : null;
      updateData.aadhaarVerifiedById = normStatus === 'VERIFIED' ? String(actorUserId || 'admin') : null;
    } else if (normField === 'BANK') {
      updateData.bankStatus = normStatus;
      updateData.bankVerifiedAt = normStatus === 'VERIFIED' ? now : null;
      updateData.bankVerifiedById = normStatus === 'VERIFIED' ? String(actorUserId || 'admin') : null;
    }

    // Determine overall status automatically
    const panSt = normField === 'PAN' ? normStatus : kyc.panStatus;
    const aadhaarSt = normField === 'AADHAAR' ? normStatus : kyc.aadhaarStatus;
    const bankSt = normField === 'BANK' ? normStatus : kyc.bankStatus;

    if (panSt === 'VERIFIED' && aadhaarSt === 'VERIFIED' && bankSt === 'VERIFIED') {
      updateData.overallStatus = 'VERIFIED';
      updateData.verifiedAt = now;
      updateData.verifiedById = String(actorUserId || 'admin');
    } else if (panSt === 'REJECTED' || aadhaarSt === 'REJECTED' || bankSt === 'REJECTED') {
      updateData.overallStatus = 'REJECTED';
      updateData.rejectionReason = remarks || 'One or more KYC documents rejected by maker-checker verification.';
    } else {
      updateData.overallStatus = 'PENDING';
    }

    const updated = await prisma.employeeKyc.update({
      where: { id: kyc.id },
      data: updateData,
    });

    await auditService.logAction({
      companyId,
      actor,
      action: `VERIFY_KYC_${normField}`,
      entityType: 'EMPLOYEE_KYC',
      entityId: kyc.id,
      beforeState: { field: normField, status: kyc[`${normField.toLowerCase()}Status`] },
      afterState: { field: normField, status: normStatus, overallStatus: updated.overallStatus },
      reason: `Maker-checker manual KYC verification of ${normField} (${normStatus}). Third-party UIDAI/NSDL integration simulated/manual.`,
    });

    return updated;
  },

  /**
   * Submit KYC Verification Request to Universal Approval Engine
   */
  async submitKycApproval(companyId, employeeProfileId, actor = {}) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw kycError('Employee profile not found.', 404);

    const kyc = await this.getKycRecord(companyId, employeeProfileId);

    const request = await approvalService.createRequest({
      companyId,
      entityType: 'EMPLOYEE_KYC',
      entityId: kyc.id,
      title: `KYC Verification for ${profile.displayName} (${profile.employeeCode})`,
      summary: `PAN Status: ${kyc.panStatus}, Aadhaar Status: ${kyc.aadhaarStatus}, Bank Status: ${kyc.bankStatus}`,
      creatorId: actor.userId || actor.id,
      creatorName: actor.name || 'HR Officer',
      role: actor.role || 'COMPANY_ADMIN',
    });

    return { success: true, approvalRequestId: request.id, kyc };
  },

  /**
   * Process decision from Approval Engine
   */
  async processApprovalDecision(companyId, employeeProfileId, decision, remarks = null, actor = {}) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: employeeProfileId, companyId },
    });
    if (!profile) throw kycError('Employee profile not found.', 404);

    const kyc = await this.getKycRecord(companyId, employeeProfileId);

    const isApprove = decision === 'APPROVED';
    const now = new Date();
    const actorId = String(actor.userId || actor.id || 'admin');

    const updated = await prisma.employeeKyc.update({
      where: { id: kyc.id },
      data: {
        panStatus: isApprove ? 'VERIFIED' : 'REJECTED',
        panVerifiedAt: isApprove ? now : null,
        panVerifiedById: isApprove ? actorId : null,
        aadhaarStatus: isApprove ? 'VERIFIED' : 'REJECTED',
        aadhaarVerifiedAt: isApprove ? now : null,
        aadhaarVerifiedById: isApprove ? actorId : null,
        bankStatus: isApprove ? 'VERIFIED' : 'REJECTED',
        bankVerifiedAt: isApprove ? now : null,
        bankVerifiedById: isApprove ? actorId : null,
        overallStatus: isApprove ? 'VERIFIED' : 'REJECTED',
        verifiedAt: isApprove ? now : null,
        verifiedById: isApprove ? actorId : null,
        rejectionReason: !isApprove ? remarks || 'KYC rejected during approval review' : null,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: isApprove ? 'APPROVE_KYC' : 'REJECT_KYC',
      entityType: 'EMPLOYEE_KYC',
      entityId: kyc.id,
      afterState: { overallStatus: updated.overallStatus },
      reason: remarks || (isApprove ? 'Approved KYC via Maker-Checker workflow' : 'Rejected KYC'),
    });

    return updated;
  },
};

export default kycService;

