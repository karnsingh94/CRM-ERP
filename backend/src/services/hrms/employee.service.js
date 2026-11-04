import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import {
  encryptSensitive,
  maskPan,
  maskAadhaar,
  maskBankAccount,
} from '../../utils/encryption.js';

function employeeError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const employeeService = {
  // =========================================================================
  // 1. DESIGNATION MASTER
  // =========================================================================

  async createDesignation(companyId, data, actor = {}) {
    const { code, title, description, departmentId, level = 1, minSalary, maxSalary, status = 'ACTIVE' } = data;
    if (!code || !title) {
      throw employeeError('Designation code and title are required.');
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await prisma.employeeDesignation.findUnique({
      where: { companyId_code: { companyId, code: cleanCode } },
    });
    if (existing) {
      throw employeeError(`Designation with code "${cleanCode}" already exists for this company.`, 409);
    }

    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, companyId },
      });
      if (!dept) throw employeeError('Invalid departmentId for this company.', 404);
    }

    const designation = await prisma.employeeDesignation.create({
      data: {
        companyId,
        code: cleanCode,
        title: title.trim(),
        description: description ? description.trim() : null,
        departmentId: departmentId || null,
        level: Number(level) || 1,
        minSalary: minSalary !== undefined && minSalary !== null ? minSalary : null,
        maxSalary: maxSalary !== undefined && maxSalary !== null ? maxSalary : null,
        status,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_DESIGNATION',
      entityType: 'EMPLOYEE_DESIGNATION',
      entityId: designation.id,
      afterState: designation,
      reason: 'Created employee designation',
    });

    return designation;
  },

  async listDesignations(companyId, filters = {}) {
    const { departmentId, status, search } = filters;
    const where = { companyId };
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { title: { contains: search } },
      ];
    }
    return prisma.employeeDesignation.findMany({
      where,
      include: { department: true },
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });
  },

  async getDesignationById(companyId, id) {
    const desig = await prisma.employeeDesignation.findFirst({
      where: { id, companyId },
      include: { department: true },
    });
    if (!desig) throw employeeError('Designation not found.', 404);
    return desig;
  },

  async updateDesignation(companyId, id, data, actor = {}) {
    const existing = await this.getDesignationById(companyId, id);
    const updated = await prisma.employeeDesignation.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title.trim() : existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        departmentId: data.departmentId !== undefined ? data.departmentId : existing.departmentId,
        level: data.level !== undefined ? Number(data.level) : existing.level,
        minSalary: data.minSalary !== undefined ? data.minSalary : existing.minSalary,
        maxSalary: data.maxSalary !== undefined ? data.maxSalary : existing.maxSalary,
        status: data.status !== undefined ? data.status : existing.status,
      },
      include: { department: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'UPDATE_DESIGNATION',
      entityType: 'EMPLOYEE_DESIGNATION',
      entityId: id,
      beforeState: existing,
      afterState: updated,
      reason: 'Updated employee designation',
    });

    return updated;
  },

  async deleteDesignation(companyId, id, actor = {}) {
    await this.getDesignationById(companyId, id);
    const inUse = await prisma.employeeProfile.count({
      where: { designationId: id },
    });
    if (inUse > 0) {
      throw employeeError(`Cannot delete designation assigned to ${inUse} employee profile(s).`, 409);
    }
    await prisma.employeeDesignation.delete({ where: { id } });
    await auditService.logAction({
      companyId,
      actor,
      action: 'DELETE_DESIGNATION',
      entityType: 'EMPLOYEE_DESIGNATION',
      entityId: id,
      reason: 'Deleted employee designation',
    });
    return { success: true };
  },

  // =========================================================================
  // 2. EMPLOYEE PROFILE CRUD & LIFECYCLE
  // =========================================================================

  async generateEmployeeCode(companyId) {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `EMP-${yyyymm}-`;

    const count = await prisma.employeeProfile.count({
      where: {
        companyId,
        employeeCode: { startsWith: prefix },
      },
    });
    const seq = String(count + 1).padStart(4, '0');
    let candidate = `${prefix}${seq}`;

    // Ensure uniqueness
    let exists = await prisma.employeeProfile.findUnique({
      where: { companyId_employeeCode: { companyId, employeeCode: candidate } },
    });
    let counter = count + 1;
    while (exists) {
      counter++;
      candidate = `${prefix}${String(counter).padStart(4, '0')}`;
      exists = await prisma.employeeProfile.findUnique({
        where: { companyId_employeeCode: { companyId, employeeCode: candidate } },
      });
    }
    return candidate;
  },

  async createProfile(companyId, data, actor = {}) {
    const {
      employeeCode,
      firstName,
      lastName,
      displayName,
      gender,
      dateOfBirth,
      dateOfJoining,
      confirmationDate,
      probationEndDate,
      employmentStatus = 'ACTIVE',
      employmentType = 'FULL_TIME',
      departmentId,
      designationId,
      reportingManagerId,
      workEmail,
      personalEmail,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      bloodGroup,
      maritalStatus,
      currentAddress,
      permanentAddress,
      // Bank
      bankName,
      bankBranch,
      bankIfsc,
      bankAccount,
      // Statutory / KYC
      pan,
      aadhaar,
      uanNumber,
      esicNumber,
      // Optional CompanyEmployee link
      employeeId,
    } = data;

    if (!firstName || !dateOfJoining) {
      throw employeeError('firstName and dateOfJoining are required.');
    }

    const code = employeeCode ? employeeCode.trim().toUpperCase() : await this.generateEmployeeCode(companyId);

    // Check duplicate code
    const existing = await prisma.employeeProfile.findUnique({
      where: { companyId_employeeCode: { companyId, employeeCode: code } },
    });
    if (existing) {
      throw employeeError(`Employee code "${code}" already exists for this company.`, 409);
    }

    // Verify department
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, companyId },
      });
      if (!dept) throw employeeError('Invalid departmentId for this company.', 404);
    }

    // Verify designation
    if (designationId) {
      const desig = await prisma.employeeDesignation.findFirst({
        where: { id: designationId, companyId },
      });
      if (!desig) throw employeeError('Invalid designationId for this company.', 404);
    }

    // Verify reporting manager belongs to same company
    if (reportingManagerId) {
      const mgr = await prisma.employeeProfile.findFirst({
        where: { id: reportingManagerId, companyId },
      });
      if (!mgr) throw employeeError('Invalid reportingManagerId: Manager must belong to the same company.', 404);
    }

    // Verify CompanyEmployee link if provided
    if (employeeId) {
      const user = await prisma.companyEmployee.findFirst({
        where: { id: employeeId, companyId },
      });
      if (!user) throw employeeError('Invalid employeeId: CompanyEmployee account not found in this company.', 404);
      const linked = await prisma.employeeProfile.findUnique({
        where: { employeeId },
      });
      if (linked) {
        throw employeeError('This CompanyEmployee account is already linked to another Employee Profile.', 409);
      }
    }

    const fullName = displayName || `${firstName} ${lastName || ''}`.trim();

    // Sensitive field handling
    const panMask = pan ? maskPan(pan) : null;
    const panEnc = pan ? encryptSensitive(pan.trim().toUpperCase()) : null;

    const aadhaarMask = aadhaar ? maskAadhaar(aadhaar) : null;
    const aadhaarEnc = aadhaar ? encryptSensitive(aadhaar.trim()) : null;

    const bankMask = bankAccount ? maskBankAccount(bankAccount) : null;
    const bankEnc = bankAccount ? encryptSensitive(bankAccount.trim()) : null;

    const profile = await prisma.employeeProfile.create({
      data: {
        companyId,
        employeeCode: code,
        employeeId: employeeId || null,
        firstName: firstName.trim(),
        lastName: lastName ? lastName.trim() : null,
        displayName: fullName,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        dateOfJoining: new Date(dateOfJoining),
        confirmationDate: confirmationDate ? new Date(confirmationDate) : null,
        probationEndDate: probationEndDate ? new Date(probationEndDate) : null,
        employmentStatus,
        employmentType,
        departmentId: departmentId || null,
        designationId: designationId || null,
        reportingManagerId: reportingManagerId || null,
        workEmail: workEmail ? workEmail.trim().toLowerCase() : null,
        personalEmail: personalEmail ? personalEmail.trim().toLowerCase() : null,
        phone: phone ? phone.trim() : null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        bloodGroup: bloodGroup || null,
        maritalStatus: maritalStatus || null,
        currentAddress: currentAddress || null,
        permanentAddress: permanentAddress || null,
        bankName: bankName || null,
        bankBranch: bankBranch || null,
        bankIfsc: bankIfsc ? bankIfsc.trim().toUpperCase() : null,
        bankAccountMasked: bankMask,
        bankAccountEncrypted: bankEnc,
        panMasked: panMask,
        panEncrypted: panEnc,
        aadhaarMasked: aadhaarMask,
        aadhaarEncrypted: aadhaarEnc,
        uanNumber: uanNumber ? uanNumber.trim() : null,
        esicNumber: esicNumber ? esicNumber.trim() : null,
        kycRecord: {
          create: {
            companyId,
            overallStatus: 'PENDING',
          },
        },
      },
      include: {
        department: true,
        designation: true,
        reportingManager: {
          select: { id: true, employeeCode: true, displayName: true, workEmail: true },
        },
        employee: {
          select: { id: true, name: true, email: true, accessRole: true },
        },
        kycRecord: true,
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'CREATE_EMPLOYEE_PROFILE',
      entityType: 'EMPLOYEE_PROFILE',
      entityId: profile.id,
      afterState: { id: profile.id, employeeCode: profile.employeeCode, displayName: profile.displayName },
      reason: 'Created employee profile master',
    });

    return profile;
  },

  async listProfiles(companyId, query = {}) {
    const {
      departmentId,
      designationId,
      reportingManagerId,
      employmentStatus,
      employmentType,
      search,
      page = 1,
      limit = 20,
    } = query;

    const where = { companyId };
    if (departmentId) where.departmentId = departmentId;
    if (designationId) where.designationId = designationId;
    if (reportingManagerId) where.reportingManagerId = reportingManagerId;
    if (employmentStatus) where.employmentStatus = employmentStatus;
    if (employmentType) where.employmentType = employmentType;

    if (search) {
      where.OR = [
        { employeeCode: { contains: search } },
        { displayName: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { workEmail: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const take = Math.max(1, Number(limit));

    const [total, items] = await Promise.all([
      prisma.employeeProfile.count({ where }),
      prisma.employeeProfile.findMany({
        where,
        skip,
        take,
        include: {
          department: true,
          designation: true,
          reportingManager: {
            select: { id: true, employeeCode: true, displayName: true },
          },
          employee: {
            select: { id: true, email: true, accessRole: true },
          },
          kycRecord: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Sanitize encrypted fields before returning
    const sanitized = items.map((p) => {
      const { panEncrypted, aadhaarEncrypted, bankAccountEncrypted, ...safe } = p;
      return safe;
    });

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
      items: sanitized,
    };
  },

  async getProfileById(companyId, id) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id, companyId },
      include: {
        department: true,
        designation: true,
        reportingManager: {
          select: { id: true, employeeCode: true, displayName: true, workEmail: true, phone: true },
        },
        employee: {
          select: { id: true, name: true, email: true, accessRole: true, phone: true },
        },
        kycRecord: true,
        documents: {
          select: { id: true, documentType: true, title: true, fileName: true, isVerified: true, expiryDate: true },
        },
        salaryAssignments: {
          where: { status: 'ACTIVE' },
          include: { structure: true },
          take: 1,
        },
      },
    });

    if (!profile) throw employeeError('Employee profile not found.', 404);

    const { panEncrypted, aadhaarEncrypted, bankAccountEncrypted, ...safe } = profile;
    return safe;
  },

  async updateProfile(companyId, id, data, actor = {}) {
    const existing = await prisma.employeeProfile.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw employeeError('Employee profile not found.', 404);

    if (data.reportingManagerId && data.reportingManagerId !== existing.reportingManagerId) {
      if (data.reportingManagerId === id) {
        throw employeeError('An employee cannot be their own reporting manager.', 400);
      }
      const mgr = await prisma.employeeProfile.findFirst({
        where: { id: data.reportingManagerId, companyId },
      });
      if (!mgr) throw employeeError('Invalid reportingManagerId for this company.', 404);
    }

    if (data.departmentId && data.departmentId !== existing.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: data.departmentId, companyId },
      });
      if (!dept) throw employeeError('Invalid departmentId for this company.', 404);
    }

    if (data.designationId && data.designationId !== existing.designationId) {
      const desig = await prisma.employeeDesignation.findFirst({
        where: { id: data.designationId, companyId },
      });
      if (!desig) throw employeeError('Invalid designationId for this company.', 404);
    }

    const updatePayload = {};

    if (data.firstName !== undefined) updatePayload.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updatePayload.lastName = data.lastName ? data.lastName.trim() : null;
    if (data.displayName !== undefined) updatePayload.displayName = data.displayName.trim();
    if (data.gender !== undefined) updatePayload.gender = data.gender;
    if (data.dateOfBirth !== undefined) updatePayload.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.confirmationDate !== undefined) updatePayload.confirmationDate = data.confirmationDate ? new Date(data.confirmationDate) : null;
    if (data.probationEndDate !== undefined) updatePayload.probationEndDate = data.probationEndDate ? new Date(data.probationEndDate) : null;
    if (data.resignationDate !== undefined) updatePayload.resignationDate = data.resignationDate ? new Date(data.resignationDate) : null;
    if (data.relievingDate !== undefined) updatePayload.relievingDate = data.relievingDate ? new Date(data.relievingDate) : null;
    if (data.employmentStatus !== undefined) updatePayload.employmentStatus = data.employmentStatus;
    if (data.employmentType !== undefined) updatePayload.employmentType = data.employmentType;
    if (data.departmentId !== undefined) updatePayload.departmentId = data.departmentId || null;
    if (data.designationId !== undefined) updatePayload.designationId = data.designationId || null;
    if (data.reportingManagerId !== undefined) updatePayload.reportingManagerId = data.reportingManagerId || null;
    if (data.workEmail !== undefined) updatePayload.workEmail = data.workEmail ? data.workEmail.trim().toLowerCase() : null;
    if (data.personalEmail !== undefined) updatePayload.personalEmail = data.personalEmail ? data.personalEmail.trim().toLowerCase() : null;
    if (data.phone !== undefined) updatePayload.phone = data.phone ? data.phone.trim() : null;
    if (data.emergencyContactName !== undefined) updatePayload.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined) updatePayload.emergencyContactPhone = data.emergencyContactPhone;
    if (data.bloodGroup !== undefined) updatePayload.bloodGroup = data.bloodGroup;
    if (data.maritalStatus !== undefined) updatePayload.maritalStatus = data.maritalStatus;
    if (data.currentAddress !== undefined) updatePayload.currentAddress = data.currentAddress;
    if (data.permanentAddress !== undefined) updatePayload.permanentAddress = data.permanentAddress;
    if (data.bankName !== undefined) updatePayload.bankName = data.bankName;
    if (data.bankBranch !== undefined) updatePayload.bankBranch = data.bankBranch;
    if (data.bankIfsc !== undefined) updatePayload.bankIfsc = data.bankIfsc ? data.bankIfsc.trim().toUpperCase() : null;
    if (data.uanNumber !== undefined) updatePayload.uanNumber = data.uanNumber ? data.uanNumber.trim() : null;
    if (data.esicNumber !== undefined) updatePayload.esicNumber = data.esicNumber ? data.esicNumber.trim() : null;

    if (data.pan) {
      updatePayload.panMasked = maskPan(data.pan);
      updatePayload.panEncrypted = encryptSensitive(data.pan.trim().toUpperCase());
    }
    if (data.aadhaar) {
      updatePayload.aadhaarMasked = maskAadhaar(data.aadhaar);
      updatePayload.aadhaarEncrypted = encryptSensitive(data.aadhaar.trim());
    }
    if (data.bankAccount) {
      updatePayload.bankAccountMasked = maskBankAccount(data.bankAccount);
      updatePayload.bankAccountEncrypted = encryptSensitive(data.bankAccount.trim());
    }

    const updated = await prisma.employeeProfile.update({
      where: { id },
      data: updatePayload,
      include: { department: true, designation: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'UPDATE_EMPLOYEE_PROFILE',
      entityType: 'EMPLOYEE_PROFILE',
      entityId: id,
      beforeState: { id, status: existing.employmentStatus },
      afterState: { id, status: updated.employmentStatus },
      reason: 'Updated employee profile',
    });

    const { panEncrypted, aadhaarEncrypted, bankAccountEncrypted, ...safe } = updated;
    return safe;
  },

  async linkCompanyEmployee(companyId, profileId, employeeId, actor = {}) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: profileId, companyId },
    });
    if (!profile) throw employeeError('Employee profile not found.', 404);

    const user = await prisma.companyEmployee.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!user) throw employeeError('CompanyEmployee account not found in this company.', 404);

    const existingLink = await prisma.employeeProfile.findUnique({
      where: { employeeId },
    });
    if (existingLink && existingLink.id !== profileId) {
      throw employeeError('This CompanyEmployee account is already linked to another profile.', 409);
    }

    const updated = await prisma.employeeProfile.update({
      where: { id: profileId },
      data: { employeeId },
      include: { employee: true },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'LINK_EMPLOYEE_LOGIN',
      entityType: 'EMPLOYEE_PROFILE',
      entityId: profileId,
      details: { linkedEmployeeId: employeeId },
      reason: 'Linked employee profile to application login account',
    });

    return updated;
  },

  async unlinkCompanyEmployee(companyId, profileId, actor = {}) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: profileId, companyId },
    });
    if (!profile) throw employeeError('Employee profile not found.', 404);

    const updated = await prisma.employeeProfile.update({
      where: { id: profileId },
      data: { employeeId: null },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'UNLINK_EMPLOYEE_LOGIN',
      entityType: 'EMPLOYEE_PROFILE',
      entityId: profileId,
      reason: 'Unlinked employee login account from profile',
    });

    return updated;
  },
};

export default employeeService;

