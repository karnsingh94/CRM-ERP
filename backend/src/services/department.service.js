import prisma from '../config/prisma.js';
import { formatEmployee, formatDepartment } from '../utils/formatters.js';
import auditService from './audit.service.js';

/**
 * Service for managing Company Employees and Service-Based Departments.
 * Enforces company boundary and Super Admin assigned-service isolation.
 */
export const departmentService = {
  /**
   * Get eligible employees for a company (with resilient fallback seeds)
   */
  async getCompanyEmployees(companyId) {
    const cid = BigInt(companyId);
    let employees = await prisma.companyEmployee.findMany({
      where: { companyId: cid },
      include: { department: true },
      orderBy: { createdAt: 'asc' },
    });

    // Auto-seed initial eligible employees if none exist for this company
    if (employees.length === 0) {
      const company = await prisma.clientAdmin.findUnique({ where: { id: cid } });
      if (company) {
        const domain = company.email && company.email.includes('@') ? company.email.split('@')[1] : 'company.com';
        const defaultSeeds = [
          {
            companyId: cid,
            name: company.name,
            email: company.email,
            role: 'Company Administrator',
            status: 'ACTIVE',
          },
          {
            companyId: cid,
            name: 'Rohan Mehra',
            email: `rohan.sales@${domain}`,
            role: 'Senior Sales Executive',
            status: 'ACTIVE',
          },
          {
            companyId: cid,
            name: 'Pooja Nair',
            email: `pooja.logistics@${domain}`,
            role: 'Logistics & Inventory Officer',
            status: 'ACTIVE',
          },
          {
            companyId: cid,
            name: 'Rajesh Verma',
            email: `rajesh.purchase@${domain}`,
            role: 'Procurement Specialist',
            status: 'ACTIVE',
          },
        ];

        for (const seed of defaultSeeds) {
          try {
            await prisma.companyEmployee.create({ data: seed });
          } catch (_) {}
        }

        employees = await prisma.companyEmployee.findMany({
          where: { companyId: cid },
          include: { department: true },
          orderBy: { createdAt: 'asc' },
        });
      }
    }

    return employees.map(formatEmployee);
  },

  /**
   * Create a new employee for a company
   */
  async createCompanyEmployee(companyId, data, meta = {}) {
    const cid = BigInt(companyId);
    const company = await prisma.clientAdmin.findUnique({ where: { id: cid } });
    if (!company) {
      const error = new Error('Company not found');
      error.statusCode = 404;
      throw error;
    }

    let deptId = null;
    if (data.departmentId || data.department_id) {
      const targetDeptId = BigInt(data.departmentId || data.department_id);
      const dept = await prisma.department.findFirst({
        where: { id: targetDeptId, companyId: cid },
      });
      if (!dept) {
        const error = new Error('Department does not belong to this company');
        error.statusCode = 400;
        throw error;
      }
      deptId = dept.id;
    }

    const employee = await prisma.companyEmployee.create({
      data: {
        companyId: cid,
        departmentId: deptId,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        role: data.role || 'Team Member',
        status: data.status || 'ACTIVE',
      },
      include: { department: true },
    });

    await auditService.logAudit({
      action: 'CREATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: employee.id,
      newValue: { name: employee.name, email: employee.email, role: employee.role, companyId: cid.toString() },
      reason: `Created employee "${employee.name}" for company #${cid}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatEmployee(employee);
  },

  /**
   * Helper to resolve service by id or code
   */
  async _resolveService(serviceCodeOrId) {
    let service = null;
    if (!isNaN(serviceCodeOrId)) {
      service = await prisma.service.findUnique({ where: { id: BigInt(serviceCodeOrId) } });
    }
    if (!service) {
      const normalizedCode = serviceCodeOrId.replace(/-/g, '_');
      service = await prisma.service.findFirst({
        where: {
          OR: [{ code: serviceCodeOrId }, { code: normalizedCode }],
        },
      });
    }
    return service;
  },

  /**
   * Get departments under a specific assigned service
   */
  async getDepartmentsByService(companyId, serviceCodeOrId) {
    const cid = BigInt(companyId);
    const service = await this._resolveService(serviceCodeOrId);

    if (!service) {
      const error = new Error('Service not found in catalogue');
      error.statusCode = 404;
      throw error;
    }

    // MANDATORY REQUIREMENT: Verify service is assigned to the company by Super Admin
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: {
        clientAdminId: cid,
        serviceId: service.id,
        isAllowed: true,
      },
    });

    if (!serviceAccess) {
      const error = new Error(`Access Denied: Service "${service.name}" is not assigned to this company.`);
      error.statusCode = 403;
      error.code = 'SERVICE_NOT_ASSIGNED';
      throw error;
    }

    const departments = await prisma.department.findMany({
      where: {
        companyId: cid,
        serviceId: service.id,
      },
      include: {
        service: true,
        head: true,
        employees: true,
        _count: { select: { employees: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      service: {
        id: service.id.toString(),
        code: service.code,
        name: service.name,
      },
      departments: departments.map(formatDepartment),
    };
  },

  /**
   * Get all departments for a company across all assigned services
   */
  async getAllDepartmentsForCompany(companyId) {
    const cid = BigInt(companyId);
    const departments = await prisma.department.findMany({
      where: { companyId: cid },
      include: {
        service: true,
        head: true,
        employees: true,
        _count: { select: { employees: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return departments.map(formatDepartment);
  },

  /**
   * Create a new department under an assigned service
   */
  async createDepartment(companyId, serviceCodeOrId, data, meta = {}) {
    const cid = BigInt(companyId);

    // 1. Validate Company Exists
    const company = await prisma.clientAdmin.findUnique({ where: { id: cid } });
    if (!company) {
      const error = new Error('Company not found');
      error.statusCode = 404;
      throw error;
    }

    // 2. Resolve Service
    const service = await this._resolveService(serviceCodeOrId);
    if (!service) {
      const error = new Error('Service not found in catalogue');
      error.statusCode = 404;
      throw error;
    }

    // 3. MANDATORY REQUIREMENT: Server-side validation of assigned-service permission
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: {
        clientAdminId: cid,
        serviceId: service.id,
        isAllowed: true,
      },
    });

    if (!serviceAccess) {
      const error = new Error(`Department creation denied: Service "${service.name}" is not assigned to ${company.organizationName}.`);
      error.statusCode = 403;
      error.code = 'SERVICE_NOT_ASSIGNED';
      throw error;
    }

    // 4. Validate Department Name
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      const error = new Error('Valid department name is required');
      error.statusCode = 400;
      throw error;
    }

    // 5. Generate / format Department Code
    let code = (data.code || data.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
    if (!code) code = `dept_${Date.now()}`;

    // Ensure unique code per company and service
    const existingDept = await prisma.department.findFirst({
      where: {
        companyId: cid,
        serviceId: service.id,
        code,
      },
    });
    if (existingDept) {
      code = `${code}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 6. MANDATORY REQUIREMENT: Department Head MUST belong to the SAME company!
    let validatedHeadId = null;
    if (data.headId || data.head_id) {
      const candidateHeadId = BigInt(data.headId || data.head_id);
      const headEmployee = await prisma.companyEmployee.findUnique({
        where: { id: candidateHeadId },
      });

      if (!headEmployee) {
        const error = new Error('Selected Department Head employee was not found.');
        error.statusCode = 400;
        throw error;
      }

      if (headEmployee.companyId !== cid) {
        const error = new Error('Cross-company violation: Department Head must belong to the same company.');
        error.statusCode = 403;
        error.code = 'CROSS_COMPANY_FORBIDDEN';
        throw error;
      }

      validatedHeadId = headEmployee.id;
    }

    // 7. Persist Department linked strictly to companyId and serviceId
    const newDept = await prisma.department.create({
      data: {
        companyId: cid,
        serviceId: service.id,
        name: data.name.trim(),
        code,
        description: data.description ? data.description.trim() : null,
        headId: validatedHeadId,
        status: data.status || 'ACTIVE',
      },
      include: {
        service: true,
        head: true,
        employees: true,
        _count: { select: { employees: true } },
      },
    });

    // If head was selected, ensure head employee's departmentId is set to this department
    if (validatedHeadId) {
      await prisma.companyEmployee.update({
        where: { id: validatedHeadId },
        data: { departmentId: newDept.id },
      });
    }

    // 8. Audit Log
    await auditService.logAudit({
      action: 'CREATE',
      entityType: 'DEPARTMENT',
      entityId: newDept.id,
      newValue: {
        id: newDept.id.toString(),
        name: newDept.name,
        code: newDept.code,
        service: service.name,
        company: company.organizationName,
        headId: validatedHeadId ? validatedHeadId.toString() : null,
      },
      reason: `Created department "${newDept.name}" under assigned service "${service.name}" for company "${company.organizationName}"`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatDepartment(newDept);
  },

  /**
   * Update an existing department
   */
  async updateDepartment(companyId, departmentId, data, meta = {}) {
    const cid = BigInt(companyId);
    const did = BigInt(departmentId);

    const existingDept = await prisma.department.findFirst({
      where: { id: did, companyId: cid },
      include: { service: true, head: true },
    });

    if (!existingDept) {
      const error = new Error('Department not found for this company');
      error.statusCode = 404;
      throw error;
    }

    let validatedHeadId = existingDept.headId;
    if (data.headId !== undefined || data.head_id !== undefined) {
      const hId = data.headId || data.head_id;
      if (hId === null || hId === '') {
        validatedHeadId = null;
      } else {
        const candidateHeadId = BigInt(hId);
        const headEmployee = await prisma.companyEmployee.findUnique({
          where: { id: candidateHeadId },
        });

        if (!headEmployee || headEmployee.companyId !== cid) {
          const error = new Error('Department Head must belong to the same company');
          error.statusCode = 403;
          throw error;
        }
        validatedHeadId = headEmployee.id;
      }
    }

    const updated = await prisma.department.update({
      where: { id: did },
      data: {
        name: data.name !== undefined ? data.name.trim() : existingDept.name,
        description: data.description !== undefined ? data.description.trim() : existingDept.description,
        status: data.status !== undefined ? data.status : existingDept.status,
        headId: validatedHeadId,
      },
      include: {
        service: true,
        head: true,
        employees: true,
        _count: { select: { employees: true } },
      },
    });

    // If head changed, link employee
    if (validatedHeadId && validatedHeadId !== existingDept.headId) {
      await prisma.companyEmployee.update({
        where: { id: validatedHeadId },
        data: { departmentId: updated.id },
      });
    }

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'DEPARTMENT',
      entityId: updated.id,
      oldValue: { name: existingDept.name, headId: existingDept.headId ? existingDept.headId.toString() : null },
      newValue: { name: updated.name, headId: updated.headId ? updated.headId.toString() : null },
      reason: `Updated department "${updated.name}" under service "${existingDept.service.name}"`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatDepartment(updated);
  },

  /**
   * Delete department
   */
  async deleteDepartment(companyId, departmentId, meta = {}) {
    const cid = BigInt(companyId);
    const did = BigInt(departmentId);

    const existingDept = await prisma.department.findFirst({
      where: { id: did, companyId: cid },
      include: { service: true },
    });

    if (!existingDept) {
      const error = new Error('Department not found for this company');
      error.statusCode = 404;
      throw error;
    }

    // Detach employees before deleting
    await prisma.companyEmployee.updateMany({
      where: { departmentId: did },
      data: { departmentId: null },
    });

    await prisma.department.delete({
      where: { id: did },
    });

    await auditService.logAudit({
      action: 'DELETE',
      entityType: 'DEPARTMENT',
      entityId: did,
      reason: `Deleted department "${existingDept.name}" from service "${existingDept.service.name}"`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return true;
  },

  /**
   * Assign employees to a department
   */
  async assignDepartmentEmployees(companyId, departmentId, employeeIds = [], meta = {}) {
    const cid = BigInt(companyId);
    const did = BigInt(departmentId);

    const existingDept = await prisma.department.findFirst({
      where: { id: did, companyId: cid },
      include: { service: true },
    });

    if (!existingDept) {
      const error = new Error('Department not found for this company');
      error.statusCode = 404;
      throw error;
    }

    // Convert to BigInts and verify all belong to same company
    const bigIntIds = employeeIds.map((id) => BigInt(id));
    const employees = await prisma.companyEmployee.findMany({
      where: { id: { in: bigIntIds } },
    });

    for (const emp of employees) {
      if (emp.companyId !== cid) {
        const error = new Error('Cross-company assignment forbidden: employee does not belong to this company');
        error.statusCode = 403;
        throw error;
      }
    }

    // Assign these employees to this department
    if (bigIntIds.length > 0) {
      await prisma.companyEmployee.updateMany({
        where: { id: { in: bigIntIds } },
        data: { departmentId: did },
      });
    }

    const updatedDept = await prisma.department.findUnique({
      where: { id: did },
      include: {
        service: true,
        head: true,
        employees: true,
        _count: { select: { employees: true } },
      },
    });

    return formatDepartment(updatedDept);
  },
};

export default departmentService;
