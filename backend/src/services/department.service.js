import prisma from '../config/prisma.js';
import { formatEmployee, formatDepartment } from '../utils/formatters.js';
import { hashPassword } from '../utils/hash.js';
import auditService from './audit.service.js';
import { validateTeamPermissions, normalizeTeamPermissions } from '../utils/team-permissions.js';
import { isUuid } from '../utils/uuid.js';

function isValidWorkEmail(value) {
  if (value.length > 254) return false;

  const parts = value.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domain] = parts;
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(localPart)
  ) {
    return false;
  }

  const labels = domain.split('.');
  if (
    labels.length < 2 ||
    labels.some((label) =>
      !label ||
      label.length > 63 ||
      !/^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(label)
    )
  ) {
    return false;
  }

  const topLevelDomain = labels.at(-1);
  return topLevelDomain.length >= 2 && /^\p{L}+$/u.test(topLevelDomain);
}

const DEPARTMENT_HEAD_ROLES = ['DEPARTMENT_HEAD', 'SERVICE_HEAD'];
const TEAM_LEADER_ROLES = ['TEAM_LEADER'];

function serviceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function assertTeamStructureManager(actor) {
  if (actor?.role === 'COMPANY_ADMIN' || DEPARTMENT_HEAD_ROLES.includes(actor?.role)) return;
  throw serviceError(
    'Only the Company Admin or Department Head can create, edit, activate, deactivate, or configure teams.',
    403,
    'TEAM_STRUCTURE_MANAGER_REQUIRED'
  );
}

function isTeamLeaderOwnedMember(actor, employee) {
  if (!TEAM_LEADER_ROLES.includes(actor?.role)) return true;
  const actorId = String(actor?.userId || '');
  return Boolean(
    actorId &&
    employee &&
    String(employee.id) !== actorId &&
    employee.accessRole === 'EMPLOYEE' &&
    String(employee.team?.headEmployeeId || '') === actorId &&
    String(employee.permissions?.memberOwnerId || '') === actorId
  );
}

function assertTeamLeaderOwnsMember(actor, employee) {
  if (!TEAM_LEADER_ROLES.includes(actor?.role)) return;
  if (!isTeamLeaderOwnedMember(actor, employee)) {
    throw serviceError(
      'A Team Leader can only manage employee accounts they created inside their own team.',
      403,
      'TEAM_MEMBER_OWNERSHIP_REQUIRED'
    );
  }
}

function parseEntityId(value, label) {
  if (!isUuid(String(value ?? ''))) {
    throw serviceError(`${label} must be a valid identifier.`, 400);
  }
  return String(value).toLowerCase();
}

async function getAvailableServiceModules(companyId, service, serviceAccess) {
  const modules = await prisma.module.findMany({
    where: { serviceId: service.id, status: 'ACTIVE' },
    include: {
      subModules: {
        where: { status: 'ACTIVE' },
        orderBy: { orderNo: 'asc' },
      },
    },
    orderBy: { orderNo: 'asc' },
  });
  if (serviceAccess.isFullService) {
    return modules.map((module) => ({
      id: module.id.toString(),
      code: module.code,
      name: module.name,
      fullAccess: true,
      subModules: module.subModules.map((subModule) => ({
        id: subModule.id.toString(),
        code: subModule.code,
        name: subModule.name,
      })),
    }));
  }

  const [moduleAccess, subModuleAccess] = await Promise.all([
    prisma.clientModuleAccess.findMany({
      where: { adminId: companyId, serviceId: service.id, isAllowed: true },
    }),
    prisma.clientSubModuleAccess.findMany({
      where: { adminId: companyId, serviceId: service.id, isAllowed: true },
    }),
  ]);
  return modules.flatMap((module) => {
    const access = moduleAccess.find((entry) => entry.moduleId === module.id);
    if (!access) return [];
    const subModules = access.accessMode === 'FULL'
      ? module.subModules
      : module.subModules.filter((subModule) => subModuleAccess.some(
        (entry) => entry.moduleId === module.id && entry.subModuleId === subModule.id
      ));
    return [{
      id: module.id.toString(),
      code: module.code,
      name: module.name,
      fullAccess: access.accessMode === 'FULL',
      subModules: subModules.map((subModule) => ({
        id: subModule.id.toString(),
        code: subModule.code,
        name: subModule.name,
      })),
    }];
  });
}

function validateFeatureAccess(permissions, availableModules) {
  const featureAccess = permissions?.featureAccess || { moduleIds: [], subModuleIds: [] };
  const moduleIds = new Set(availableModules.map((module) => module.id));
  const subModuleIds = new Set(availableModules.flatMap((module) => module.subModules.map((subModule) => subModule.id)));
  return featureAccess.moduleIds.every((id) => moduleIds.has(id)) &&
    featureAccess.subModuleIds.every((id) => subModuleIds.has(id));
}

function scopeModulesToPermissions(availableModules, permissions) {
  const featureAccess = permissions?.featureAccess || {};
  const permittedModuleIds = new Set((featureAccess.moduleIds || []).map(String));
  const permittedSubModuleIds = new Set((featureAccess.subModuleIds || []).map(String));

  return availableModules.flatMap((module) => {
    const moduleId = String(module.id);
    if (permittedModuleIds.has(moduleId)) {
      return [{ ...module, fullAccess: true }];
    }

    const subModules = (module.subModules || []).filter((subModule) => (
      permittedSubModuleIds.has(String(subModule.id))
    ));
    if (!subModules.length) return [];
    return [{ ...module, fullAccess: false, subModules }];
  });
}

function validateDelegatedFeatureAccess(permissions, parentPermissions, availableModules) {
  const requested = permissions?.featureAccess || {};
  const parent = parentPermissions?.featureAccess || {};
  const parentModuleIds = new Set((parent.moduleIds || []).map(String));
  const parentSubModuleIds = new Set((parent.subModuleIds || []).map(String));
  const subModuleParents = new Map(
    availableModules.flatMap((module) => (
      (module.subModules || []).map((subModule) => [String(subModule.id), String(module.id)])
    ))
  );

  return (requested.moduleIds || []).every((moduleId) => parentModuleIds.has(String(moduleId))) &&
    (requested.subModuleIds || []).every((subModuleId) => {
      const id = String(subModuleId);
      const parentModuleId = subModuleParents.get(id);
      return parentSubModuleIds.has(id) || (parentModuleId && parentModuleIds.has(parentModuleId));
    });
}

async function assertTeamLeaderDelegationScope(companyId, actor, permissions, availableModules) {
  if (!TEAM_LEADER_ROLES.includes(actor?.role)) return;
  const leader = await prisma.companyEmployee.findFirst({
    where: {
      id: String(actor.userId || ''),
      companyId: String(companyId),
      status: 'ACTIVE',
      accessRole: 'TEAM_LEADER',
    },
    select: { permissions: true },
  });
  if (!leader || !validateDelegatedFeatureAccess(permissions, leader.permissions, availableModules)) {
    throw serviceError(
      'A Team Leader can only assign modules and screens granted by the Department Head.',
      403,
      'DELEGATED_FEATURE_SCOPE_EXCEEDED'
    );
  }
}

/**
 * Service for managing company employees and named teams under assigned services.
 * Enforces company boundary and Super Admin assigned-service isolation.
 */
export const departmentService = {
  async ensureCompanyDepartment(companyId, service) {
    const cid = String(companyId);
    let department = await prisma.department.findFirst({
      where: { companyId: cid, serviceId: service.id },
    });
    if (!department) {
      department = await prisma.department.create({
        data: {
          companyId: cid,
          serviceId: service.id,
          name: service.name,
          code: service.code,
          status: 'ACTIVE',
        },
      });
    }
    return department;
  },

  /**
   * Get eligible employees for a company
   */
  async getCompanyEmployees(companyId, actor) {
    const cid = String(companyId);
    const where = { companyId: cid };
    if (actor?.role !== 'COMPANY_ADMIN') {
      const employeeId = String(actor?.userId || '');
      if (DEPARTMENT_HEAD_ROLES.includes(actor?.role)) {
        const head = await prisma.companyEmployee.findFirst({
          where: { id: employeeId, companyId: cid, status: 'ACTIVE' },
          include: { department: true, team: true },
        });
        const serviceId = head?.department?.serviceId || head?.team?.serviceId;
        if (serviceId) {
          where.OR = [
            { department: { serviceId } },
            { team: { serviceId } },
          ];
        }
      } else {
        const team = await prisma.companyServiceTeam.findFirst({
          where: { companyId: cid, headEmployeeId: employeeId },
          select: { id: true },
        });
        if (!team) {
          throw serviceError('Only a company admin, Department Head, or Team Leader with member-management access can view employees.', 403);
        }
        where.teamId = team.id;
        where.id = { not: employeeId };
        where.accessRole = 'EMPLOYEE';
      }
    }
    const employees = await prisma.companyEmployee.findMany({
      where,
      include: {
        department: { include: { service: true } },
        team: { include: { service: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const visibleEmployees = TEAM_LEADER_ROLES.includes(actor?.role)
      ? employees.filter((employee) => (
        String(employee.permissions?.memberOwnerId || '') === String(actor.userId)
      ))
      : employees;

    return visibleEmployees.map(formatEmployee);
  },

  /**
   * Create a new employee for a company
   */
  async createCompanyEmployee(companyId, data, meta = {}, actor) {
    const cid = String(companyId);
    const company = await prisma.clientAdmin.findUnique({ where: { id: cid } });
    if (!company) {
      const error = new Error('Company not found');
      error.statusCode = 404;
      throw error;
    }

    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const phone = typeof data.phone === 'string' && data.phone.trim() ? data.phone.trim() : null;
    const password = data.password;
    const serviceCode = data.serviceCode || data.serviceId;
    const accessRole = data.accessRole || 'EMPLOYEE';
    const designation = typeof data.role === 'string' ? data.role.trim() : '';

    if (!name || !email || !serviceCode || typeof password !== 'string' || password.length < 8) {
      const error = new Error('Name, work email, assigned service, and a password of at least 8 characters are required.');
      error.statusCode = 400;
      throw error;
    }

    if (
      name.length > 100 ||
      !/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(name) ||
      !isValidWorkEmail(email) ||
      password.length > 128 ||
      designation.length > 100 ||
      (designation && !/^[\p{L}\p{M}\p{N}\s&.,'’()/+-]*$/u.test(designation)) ||
      (phone && !/^[0-9+() -]{7,25}$/.test(phone))
    ) {
      const error = new Error('Enter a valid employee name, work email, phone number, job designation, and password.');
      error.statusCode = 400;
      throw error;
    }

    if (!['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(accessRole)) {
      throw serviceError('Choose Department Head, Team Leader, or Employee as the access role.', 400);
    }

    const service = await this._resolveService(String(serviceCode));
    if (!service || service.status !== 'ACTIVE') {
      const error = new Error('The selected service is not available.');
      error.statusCode = service ? 403 : 404;
      error.code = service ? 'SERVICE_INACTIVE' : 'SERVICE_NOT_FOUND';
      throw error;
    }

    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) {
      const error = new Error('The selected service is not assigned to this company by Super Admin.');
      error.statusCode = 403;
      error.code = 'SERVICE_NOT_ASSIGNED';
      throw error;
    }

    const isDeptHeadRole = accessRole === 'DEPARTMENT_HEAD' || accessRole === 'SERVICE_HEAD';

    let requestedTeamId = data.teamId || null;
    const isDeptHeadActor = DEPARTMENT_HEAD_ROLES.includes(actor?.role);
    if (!isDeptHeadActor && actor?.role === 'TEAM_LEADER') {
      const team = await prisma.companyServiceTeam.findFirst({
        where: {
          companyId: cid,
          serviceId: service.id,
          headEmployeeId: String(actor.userId),
        },
        select: { id: true },
      });
      if (!team || (data.teamId && String(data.teamId) !== team.id.toString()) || accessRole !== 'EMPLOYEE') {
        throw serviceError('A Team Leader can only add employees to their own team.', 403);
      }
      requestedTeamId = team.id.toString();
    }

    const requestedPermissions = accessRole === 'EMPLOYEE'
      ? (data.permissions ? normalizeTeamPermissions(data.permissions) : null)
      : validateTeamPermissions(data.permissions);
    if (accessRole !== 'EMPLOYEE' && (!requestedPermissions || !data.permissions?.featureAccess)) {
      throw serviceError('Permissions must include explicit management actions and feature access.', 400);
    }
    const availableServiceModules = await getAvailableServiceModules(cid, service, serviceAccess);
    if (requestedPermissions && !validateFeatureAccess(requestedPermissions, availableServiceModules)) {
      throw serviceError('Feature permissions must be within the company-approved service access.', 400);
    }
    await assertTeamLeaderDelegationScope(cid, actor, requestedPermissions, availableServiceModules);

    const passwordHash = hashPassword(password);
    let employee;

    // Direct Department Head creation (scoped to department, no team required)
    if (isDeptHeadRole) {
      const department = await this.ensureCompanyDepartment(cid, service);
      try {
        employee = await prisma.companyEmployee.create({
          data: {
            companyId: cid,
            departmentId: department.id,
            teamId: null,
            name,
            email,
            phone,
            role: designation || 'Department Head',
            accessRole: 'DEPARTMENT_HEAD',
            permissions: requestedPermissions,
            passwordHash,
            status: data.status || 'ACTIVE',
          },
          include: {
            department: { include: { service: true } },
            team: { include: { service: true } },
          },
        });

        if (!department.headId) {
          await prisma.department.update({
            where: { id: department.id },
            data: { headId: employee.id },
          }).catch(() => {});
        }
      } catch (error) {
        if (error.code === 'P2002') {
          const conflict = new Error('An employee with this Login ID / email already exists in the company.');
          conflict.statusCode = 409;
          conflict.code = 'EMPLOYEE_EMAIL_EXISTS';
          throw conflict;
        }
        throw error;
      }

      await auditService.logAudit({
        action: 'CREATE',
        entityType: 'COMPANY_EMPLOYEE',
        entityId: employee.id,
        newValue: {
          name: employee.name,
          email: employee.email,
          role: employee.role,
          accessRole: 'DEPARTMENT_HEAD',
          service: service.code,
          departmentId: department.id.toString(),
          permissions: employee.permissions,
          companyId: cid.toString(),
        },
        reason: `Created Department Head "${employee.name}" for "${service.name}" in company #${cid}`,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });

      return formatEmployee(employee);
    }

    if (!requestedTeamId) {
      throw serviceError('Create and select a team before adding an employee.', 400);
    }

    try {
      employee = await prisma.$transaction(async (tx) => {
        const teamId = parseEntityId(requestedTeamId, 'Team');
        const team = await tx.companyServiceTeam.findFirst({
          where: { id: teamId, companyId: cid, serviceId: service.id },
        });
        if (!team) throw serviceError('Choose a team belonging to the selected service.', 400);

        if (accessRole !== 'EMPLOYEE' && team.headEmployeeId) {
          throw serviceError('This team already has a Team Leader.', 409, 'TEAM_LEADER_EXISTS');
        }

        const permissionsToStore = TEAM_LEADER_ROLES.includes(actor?.role)
          ? {
            ...(requestedPermissions || normalizeTeamPermissions(null)),
            memberOwnerId: String(actor.userId),
          }
          : requestedPermissions;

        const created = await tx.companyEmployee.create({
          data: {
            companyId: cid,
            teamId: team.id,
            name,
            email,
            phone,
            role: designation || 'Team Member',
            accessRole: accessRole === 'SERVICE_HEAD' ? 'TEAM_LEADER' : accessRole,
            permissions: permissionsToStore,
            passwordHash,
            status: data.status || 'ACTIVE',
          },
          include: {
            department: { include: { service: true } },
            team: { include: { service: true } },
          },
        });

        if (accessRole !== 'EMPLOYEE') {
          const claimedHead = await tx.companyServiceTeam.updateMany({
            where: { id: team.id, headEmployeeId: null },
            data: { headEmployeeId: created.id },
          });
          if (claimedHead.count !== 1) {
            throw serviceError('This team already has a Team Leader.', 409, 'TEAM_LEADER_EXISTS');
          }
        }
        return created;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        const conflict = new Error('An employee with this Login ID / email already exists in the company.');
        conflict.statusCode = 409;
        conflict.code = 'EMPLOYEE_EMAIL_EXISTS';
        throw conflict;
      }
      throw error;
    }

    await auditService.logAudit({
      action: 'CREATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: employee.id,
      newValue: {
        name: employee.name,
        email: employee.email,
        phone: employee.phone || null,
        role: employee.role,
        accessRole: employee.accessRole,
        service: service.code,
        teamId: employee.teamId ? employee.teamId.toString() : null,
        teamName: employee.team?.name || null,
        permissions: employee.permissions,
        companyId: cid.toString(),
      },
      reason: `Created employee "${employee.name}" for company #${cid}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatEmployee(employee);
  },

  async toggleCompanyEmployeeStatus(companyId, employeeId, meta = {}, actor = null) {
    const cid = String(companyId);
    const eid = parseEntityId(employeeId, 'Employee');
    const employee = await prisma.companyEmployee.findFirst({
      where: { id: eid, companyId: cid },
      include: { team: true },
    });
    if (!employee) throw serviceError('Employee not found.', 404);
    assertTeamLeaderOwnsMember(actor, employee);

    const nextStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.companyEmployee.update({
      where: { id: employee.id },
      data: { status: nextStatus },
      include: {
        department: { include: { service: true } },
        team: { include: { service: true } },
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: updated.id,
      newValue: { status: nextStatus, name: updated.name },
      reason: `Changed employee "${updated.name}" status to ${nextStatus}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatEmployee(updated);
  },

  async removeServiceTeamEmployee(companyId, serviceCodeOrId, teamId, employeeId, meta = {}, actor) {
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) {
      const error = new Error('Service not found in catalogue.');
      error.statusCode = 404;
      throw error;
    }

    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) {
      throw serviceError('This service is not assigned to the company.', 403, 'SERVICE_NOT_ASSIGNED');
    }

    const team = await prisma.companyServiceTeam.findFirst({
      where: {
        id: parseEntityId(teamId, 'Team'),
        companyId: cid,
        serviceId: service.id,
        ...(TEAM_LEADER_ROLES.includes(actor?.role) ? { headEmployeeId: String(actor.userId) } : {}),
      },
      select: { id: true, headEmployeeId: true },
    });
    if (!team) {
      const error = new Error('This team was not found for the company service.');
      error.statusCode = 404;
      throw error;
    }

    const employee = await prisma.companyEmployee.findFirst({
      where: { id: parseEntityId(employeeId, 'Employee'), companyId: cid, teamId: team.id },
      select: { id: true, name: true, email: true, accessRole: true, permissions: true, team: true },
    });
    if (!employee) {
      const error = new Error('Employee was not found in a team under this service.');
      error.statusCode = 404;
      throw error;
    }

    assertTeamLeaderOwnsMember(actor, employee);

    await prisma.$transaction(async (tx) => {
      if (team.headEmployeeId === employee.id) {
        await tx.companyServiceTeam.update({
          where: { id: team.id },
          data: { headEmployeeId: null },
        });
      }

      await tx.companyEmployee.update({
        where: { id: employee.id },
        data: {
          status: 'INACTIVE',
          teamId: null,
          accessRole: 'EMPLOYEE',
          permissions: null,
        },
      });
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: employee.id,
      oldValue: { name: employee.name, email: employee.email, service: service.code },
      newValue: { status: 'INACTIVE', removedFromService: service.code },
      reason: `Removed employee "${employee.name}" from "${service.name}" service assignment`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.listServiceTeams(companyId, serviceCodeOrId, actor);
  },

  /**
   * Helper to resolve service by id or code
   */
  async _resolveService(serviceCodeOrId) {
    let service = null;
    if (isUuid(serviceCodeOrId)) {
      service = await prisma.service.findUnique({ where: { id: String(serviceCodeOrId).toLowerCase() } });
    }
    if (!service) {
      const normalizedCode = String(serviceCodeOrId).replace(/-/g, '_');
      service = await prisma.service.findFirst({
        where: {
          OR: [{ code: String(serviceCodeOrId) }, { code: normalizedCode }],
        },
      });
    }
    return service;
  },

  async listServiceTeams(companyId, serviceCodeOrId, actor) {
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);
    if (service.status !== 'ACTIVE') {
      throw serviceError(`Service "${service.name}" is currently deactivated by Super Admin.`, 403, 'SERVICE_INACTIVE');
    }
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) {
      throw serviceError(`Service "${service.name}" is not assigned to this company.`, 403, 'SERVICE_NOT_ASSIGNED');
    }

    const where = { companyId: cid, serviceId: service.id };
    if (TEAM_LEADER_ROLES.includes(actor?.role)) where.headEmployeeId = String(actor.userId);
    const [teams, availableModules, department, departmentHeads, actorEmployee] = await Promise.all([
      prisma.companyServiceTeam.findMany({
        where,
        include: {
          head: true,
          employees: {
            ...(TEAM_LEADER_ROLES.includes(actor?.role)
              ? {
                where: {
                  id: { not: String(actor.userId) },
                  accessRole: 'EMPLOYEE',
                },
              }
              : {}),
            include: {
              department: { include: { service: true } },
              team: { include: { service: true } },
            },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
      }),
      getAvailableServiceModules(cid, service, serviceAccess),
      this.ensureCompanyDepartment(cid, service),
      prisma.companyEmployee.findMany({
        where: {
          companyId: cid,
          OR: [
            { department: { serviceId: service.id } },
            { team: { serviceId: service.id } },
          ],
          accessRole: { in: ['DEPARTMENT_HEAD', 'SERVICE_HEAD'] },
          status: 'ACTIVE',
        },
        include: {
          department: { include: { service: true } },
          team: { include: { service: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
      }),
      TEAM_LEADER_ROLES.includes(actor?.role)
        ? prisma.companyEmployee.findFirst({
          where: {
            id: String(actor.userId),
            companyId: cid,
            status: 'ACTIVE',
            accessRole: 'TEAM_LEADER',
          },
          select: { permissions: true },
        })
        : Promise.resolve(null),
    ]);
    const scopedAvailableModules = TEAM_LEADER_ROLES.includes(actor?.role)
      ? scopeModulesToPermissions(availableModules, actorEmployee?.permissions)
      : availableModules;
    const visibleTeams = teams.filter(
      (team) => team.name.trim().toLocaleLowerCase() !== `${service.name} team`.toLocaleLowerCase() ||
        team.headEmployeeId ||
        team.employees.length > 0
    );
    return {
      service: { id: service.id.toString(), code: service.code, name: service.name },
      department: { id: department.id.toString(), name: department.name, code: department.code },
      departmentHeads: departmentHeads.map(formatEmployee),
      availableModules: scopedAvailableModules,
      teams: visibleTeams.map((team) => ({
        id: team.id.toString(),
        name: team.name,
        description: team.description || '',
        status: team.status || 'ACTIVE',
        head: team.head ? formatEmployee({ ...team.head, team: { service, headEmployeeId: team.headEmployeeId } }) : null,
        employees: team.employees
          .filter((employee) => (
            !TEAM_LEADER_ROLES.includes(actor?.role) ||
            String(employee.permissions?.memberOwnerId || '') === String(actor.userId)
          ))
          .map(formatEmployee),
      })),
    };
  },

  async createServiceTeam(companyId, serviceCodeOrId, data, meta = {}, actor = null) {
    assertTeamStructureManager(actor);
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service || service.status !== 'ACTIVE') {
      throw serviceError(service ? 'The selected service is inactive.' : 'Service not found in catalogue.', service ? 403 : 404);
    }
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) throw serviceError('This service is not assigned to the company.', 403, 'SERVICE_NOT_ASSIGNED');

    const cleanName = typeof data === 'string' ? data.trim() : (data?.name || '').trim();
    const cleanDesc = typeof data === 'object' && data.description ? data.description.trim() : null;
    const requestedHeadId = typeof data === 'object' && data.headEmployeeId ? String(data.headEmployeeId) : null;

    if (!cleanName || cleanName.length > 150) {
      throw serviceError('Team name must contain between 1 and 150 characters.', 400);
    }
    if (cleanName.toLocaleLowerCase() === `${service.name} team`.toLocaleLowerCase()) {
      throw serviceError('A service is not a team. Choose a distinct team name.', 400);
    }

    let team;
    try {
      team = await prisma.$transaction(async (tx) => {
        let candidateHead = null;
        if (requestedHeadId) {
          candidateHead = await tx.companyEmployee.findFirst({
            where: { id: requestedHeadId, companyId: cid },
          });
          if (!candidateHead) {
            throw serviceError('Selected Team Leader was not found.', 400);
          }
        }

        const newTeam = await tx.companyServiceTeam.create({
          data: {
            companyId: cid,
            serviceId: service.id,
            name: cleanName,
            description: cleanDesc,
            status: 'ACTIVE',
            headEmployeeId: candidateHead ? candidateHead.id : null,
          },
          include: {
            service: true,
            head: true,
            employees: {
              include: {
                department: { include: { service: true } },
                team: { include: { service: true } },
              },
            },
          },
        });

        if (candidateHead) {
          await tx.companyEmployee.update({
            where: { id: candidateHead.id },
            data: {
              teamId: newTeam.id,
              accessRole: 'TEAM_LEADER',
            },
          });
        }

        return newTeam;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw serviceError('A team with this name already exists for the selected service.', 409, 'TEAM_NAME_EXISTS');
      }
      throw error;
    }

    await auditService.logAudit({
      action: 'CREATE',
      entityType: 'COMPANY_SERVICE_TEAM',
      entityId: team.id,
      newValue: { name: team.name, service: service.code, companyId: cid.toString() },
      reason: `Created team "${team.name}" for "${service.name}" in company #${cid}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      id: team.id.toString(),
      name: team.name,
      description: team.description || '',
      status: team.status,
      head: team.head ? formatEmployee({ ...team.head, team: { service, headEmployeeId: team.headEmployeeId } }) : null,
      employees: team.employees.map(formatEmployee),
    };
  },

  async toggleServiceTeamStatus(companyId, serviceCodeOrId, teamId, meta = {}, actor = null) {
    assertTeamStructureManager(actor);
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);

    const tid = parseEntityId(teamId, 'Team');
    const team = await prisma.companyServiceTeam.findFirst({
      where: { id: tid, companyId: cid, serviceId: service.id },
    });
    if (!team) throw serviceError('Team not found.', 404);

    const nextStatus = team.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.companyServiceTeam.update({
      where: { id: team.id },
      data: { status: nextStatus },
      include: {
        service: true,
        head: true,
        employees: {
          include: {
            department: { include: { service: true } },
            team: { include: { service: true } },
          },
        },
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_SERVICE_TEAM',
      entityId: updated.id,
      newValue: { status: nextStatus, name: updated.name },
      reason: `Changed team "${updated.name}" status to ${nextStatus}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      id: updated.id.toString(),
      name: updated.name,
      description: updated.description || '',
      status: updated.status,
      head: updated.head ? formatEmployee({ ...updated.head, team: { service, headEmployeeId: updated.headEmployeeId } }) : null,
      employees: updated.employees.map(formatEmployee),
    };
  },

  async updateServiceTeam(companyId, serviceCodeOrId, teamId, data, meta = {}, actor = null) {
    assertTeamStructureManager(actor);
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);

    const tid = parseEntityId(teamId, 'Team');
    const team = await prisma.companyServiceTeam.findFirst({
      where: { id: tid, companyId: cid, serviceId: service.id },
    });
    if (!team) throw serviceError('Team not found.', 404);

    const updateData = {};
    if (data.name && typeof data.name === 'string') {
      const cleanName = data.name.trim();
      if (!cleanName || cleanName.length > 150) {
        throw serviceError('Team name must contain between 1 and 150 characters.', 400);
      }
      updateData.name = cleanName;
    }
    if (data.description !== undefined) {
      updateData.description = typeof data.description === 'string' ? data.description.trim() : null;
    }
    if (data.status && ['ACTIVE', 'INACTIVE'].includes(data.status)) {
      updateData.status = data.status;
    }

    const updated = await prisma.companyServiceTeam.update({
      where: { id: team.id },
      data: updateData,
      include: {
        service: true,
        head: true,
        employees: {
          include: {
            department: { include: { service: true } },
            team: { include: { service: true } },
          },
        },
      },
    });

    return {
      id: updated.id.toString(),
      name: updated.name,
      description: updated.description || '',
      status: updated.status,
      head: updated.head ? formatEmployee({ ...updated.head, team: { service, headEmployeeId: updated.headEmployeeId } }) : null,
      employees: updated.employees.map(formatEmployee),
    };
  },

  async createDepartmentHead(companyId, serviceCodeOrId, data, meta = {}, actor) {
    const cid = String(companyId);
    return this.createCompanyEmployee(
      cid,
      {
        ...data,
        serviceCode: serviceCodeOrId,
        accessRole: 'DEPARTMENT_HEAD',
      },
      meta,
      actor
    );
  },

  async updateDepartmentHead(companyId, serviceCodeOrId, employeeId, data, meta = {}, actor) {
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) throw serviceError('This service is not assigned to the company.', 403, 'SERVICE_NOT_ASSIGNED');

    const eid = parseEntityId(employeeId, 'Department Head');
    const employee = await prisma.companyEmployee.findFirst({
      where: { id: eid, companyId: cid },
    });
    if (!employee) throw serviceError('Department Head employee not found.', 404);

    const updateData = {};

    if (data.name && typeof data.name === 'string') {
      const name = data.name.trim();
      if (name.length < 2 || name.length > 100) {
        throw serviceError('Full Name must be between 2 and 100 characters.', 400);
      }
      updateData.name = name;
    }

    if (data.role !== undefined) {
      updateData.role = typeof data.role === 'string' ? data.role.trim() : 'Department Head';
    }

    if (data.phone !== undefined) {
      const phone = typeof data.phone === 'string' && data.phone.trim() ? data.phone.trim() : null;
      if (phone && !/^[0-9+() -]{7,25}$/.test(phone)) {
        throw serviceError('Enter a valid phone number.', 400);
      }
      updateData.phone = phone;
    }

    if (data.status && ['ACTIVE', 'INACTIVE'].includes(data.status)) {
      updateData.status = data.status;
    }

    if (data.password && typeof data.password === 'string' && data.password.trim().length >= 8) {
      updateData.passwordHash = hashPassword(data.password.trim());
    }

    if (data.permissions) {
      const normalizedPermissions = validateTeamPermissions(data.permissions);
      if (!normalizedPermissions) {
        throw serviceError('Department Head permissions must include explicit actions and valid feature access.', 400);
      }
      if (!validateFeatureAccess(normalizedPermissions, await getAvailableServiceModules(cid, service, serviceAccess))) {
        throw serviceError('Department Head permissions must be within company-approved service access.', 400);
      }
      updateData.permissions = normalizedPermissions;
    }

    const updated = await prisma.companyEmployee.update({
      where: { id: employee.id },
      data: updateData,
      include: {
        department: { include: { service: true } },
        team: { include: { service: true } },
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: updated.id,
      newValue: {
        name: updated.name,
        role: updated.role,
        phone: updated.phone,
        status: updated.status,
        permissions: updated.permissions,
        service: service.code,
      },
      reason: `Updated Department Head "${updated.name}" in company #${cid}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatEmployee(updated);
  },

  async toggleDepartmentHeadStatus(companyId, serviceCodeOrId, employeeId, meta = {}, actor) {
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);

    const eid = parseEntityId(employeeId, 'Department Head');
    const employee = await prisma.companyEmployee.findFirst({
      where: { id: eid, companyId: cid },
    });
    if (!employee) throw serviceError('Department Head employee not found.', 404);

    const nextStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated = await prisma.companyEmployee.update({
      where: { id: employee.id },
      data: { status: nextStatus },
      include: {
        department: { include: { service: true } },
        team: { include: { service: true } },
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: updated.id,
      newValue: { status: nextStatus },
      reason: `Changed Department Head "${updated.name}" status to ${nextStatus}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatEmployee(updated);
  },

  async updateDepartmentHeadPermissions(companyId, serviceCodeOrId, employeeId, permissions, meta = {}) {
    const normalizedPermissions = validateTeamPermissions(permissions);
    if (!normalizedPermissions) {
      throw serviceError('Department Head permissions must include explicit actions and valid feature access.', 400);
    }
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) throw serviceError('This service is not assigned to the company.', 403, 'SERVICE_NOT_ASSIGNED');

    if (!validateFeatureAccess(normalizedPermissions, await getAvailableServiceModules(cid, service, serviceAccess))) {
      throw serviceError('Department Head permissions must be within company-approved service access.', 400);
    }

    const eid = parseEntityId(employeeId, 'Department Head');
    const employee = await prisma.companyEmployee.findFirst({
      where: { id: eid, companyId: cid, status: 'ACTIVE' },
    });
    if (!employee) throw serviceError('Department Head employee not found.', 404);

    const updated = await prisma.companyEmployee.update({
      where: { id: employee.id },
      data: {
        accessRole: 'DEPARTMENT_HEAD',
        permissions: normalizedPermissions,
      },
      include: {
        department: { include: { service: true } },
        team: { include: { service: true } },
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: updated.id,
      newValue: { permissions: normalizedPermissions, service: service.code },
      reason: `Updated permissions for Department Head "${updated.name}" in company #${cid}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatEmployee(updated);
  },

  async removeDepartmentHead(companyId, serviceCodeOrId, employeeId, meta = {}, actor) {
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);
    const eid = parseEntityId(employeeId, 'Department Head');

    const employee = await prisma.companyEmployee.findFirst({
      where: { id: eid, companyId: cid },
      include: { department: true },
    });
    if (!employee) throw serviceError('Department Head not found.', 404);

    await prisma.$transaction(async (tx) => {
      if (employee.departmentId) {
        await tx.department.updateMany({
          where: { id: employee.departmentId, headId: employee.id },
          data: { headId: null },
        });
      }
      await tx.companyEmployee.delete({
        where: { id: employee.id },
      });
    });

    await auditService.logAudit({
      action: 'DELETE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: employee.id,
      reason: `Removed Department Head "${employee.name}" from service "${service.name}" in company #${cid}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.listServiceTeams(companyId, serviceCodeOrId, actor || { role: 'COMPANY_ADMIN' });
  },

  async getServiceTeam(companyId, serviceCodeOrId, actor, teamId = null) {
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) {
      const error = new Error('Service not found in catalogue.');
      error.statusCode = 404;
      throw error;
    }
    if (service.status !== 'ACTIVE') {
      const error = new Error(`Service "${service.name}" is currently deactivated by Super Admin.`);
      error.statusCode = 403;
      error.code = 'SERVICE_INACTIVE';
      throw error;
    }

    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) {
      const error = new Error(`Service "${service.name}" is not assigned to this company.`);
      error.statusCode = 403;
      error.code = 'SERVICE_NOT_ASSIGNED';
      throw error;
    }

    let existingTeam = null;
    if (actor?.role !== 'COMPANY_ADMIN') {
      const employee = await prisma.companyEmployee.findFirst({
        where: {
          id: String(actor?.userId || ''),
          companyId: cid,
          status: 'ACTIVE',
          team: { serviceId: service.id },
        },
        select: { teamId: true },
      });
      if (!employee?.teamId) {
        const error = new Error('This team is outside your assigned service.');
        error.statusCode = 403;
        error.code = 'SERVICE_SCOPE_VIOLATION';
        throw error;
      }
      existingTeam = await prisma.companyServiceTeam.findFirst({
        where: { id: employee.teamId, companyId: cid, serviceId: service.id },
      });
    } else if (teamId) {
      existingTeam = await prisma.companyServiceTeam.findFirst({
        where: { id: parseEntityId(teamId, 'Team'), companyId: cid, serviceId: service.id },
      });
    } else {
      throw serviceError('Choose a team for this service.', 400);
    }

    if (!existingTeam) {
      throw serviceError('No team exists for this service yet.', 404, 'TEAM_NOT_FOUND');
    }
    const team = await prisma.companyServiceTeam.findUnique({
      where: { id: existingTeam.id },
      include: {
        service: true,
        head: true,
        employees: {
          include: {
            department: { include: { service: true } },
            team: { include: { service: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    const visibleEmployees = TEAM_LEADER_ROLES.includes(actor?.role)
      ? team.employees.filter((employee) => isTeamLeaderOwnedMember(actor, employee))
      : team.employees;

    return {
      id: team.id.toString(),
      name: team.name,
      service: { id: service.id.toString(), code: service.code, name: service.name },
      head: team.head
        ? formatEmployee({ ...team.head, team: { service, headEmployeeId: team.headEmployeeId } })
        : null,
      employees: visibleEmployees.map(formatEmployee),
    };
  },

  async setServiceTeamHead(companyId, serviceCodeOrId, headId, meta = {}, teamId = null, actor = null) {
    assertTeamStructureManager(actor);
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service || service.status !== 'ACTIVE') {
      const error = new Error(service ? 'The selected service is inactive.' : 'Service not found in catalogue.');
      error.statusCode = service ? 403 : 404;
      throw error;
    }
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) {
      const error = new Error('This service is not assigned to the company.');
      error.statusCode = 403;
      error.code = 'SERVICE_NOT_ASSIGNED';
      throw error;
    }

    if (!teamId) throw serviceError('Choose a team before assigning a Team Leader.', 400);
    const newHeadId = headId ? parseEntityId(headId, 'Team Leader') : null;
    const team = await prisma.$transaction(async (tx) => {
      const currentTeam = await tx.companyServiceTeam.findFirst({
        where: { id: parseEntityId(teamId, 'Team'), companyId: cid, serviceId: service.id },
      });
      if (!currentTeam) throw serviceError('The selected team does not belong to this service.', 404);
      if (newHeadId) {
        const candidate = await tx.companyEmployee.findFirst({
          where: { id: newHeadId, companyId: cid, teamId: currentTeam.id, status: 'ACTIVE' },
        });
        if (!candidate) {
          const error = new Error('The Team Leader must be an active employee assigned to this team.');
          error.statusCode = 400;
          throw error;
        }
        if (currentTeam.headEmployeeId && currentTeam.headEmployeeId !== newHeadId) {
          await tx.companyEmployee.update({
            where: { id: currentTeam.headEmployeeId },
            data: { accessRole: 'EMPLOYEE', permissions: null },
          });
        }
        await tx.companyEmployee.update({
          where: { id: newHeadId },
          data: { accessRole: 'TEAM_LEADER' },
        });
      } else if (currentTeam.headEmployeeId) {
        await tx.companyEmployee.update({
          where: { id: currentTeam.headEmployeeId },
          data: { accessRole: 'EMPLOYEE', permissions: null },
        });
      }

      return tx.companyServiceTeam.update({
        where: { id: currentTeam.id },
        data: { headEmployeeId: newHeadId },
      });
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_SERVICE_TEAM',
      entityId: team.id,
      newValue: { service: service.code, headId: newHeadId?.toString() || null },
      reason: `Updated Team Leader for "${service.name}" team in company #${cid}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.getServiceTeam(companyId, serviceCodeOrId, { role: 'COMPANY_ADMIN' }, team.id.toString());
  },

  async setServiceTeamPermissions(companyId, serviceCodeOrId, permissions, meta = {}, teamId = null, actor = null) {
    assertTeamStructureManager(actor);
    const normalizedPermissions = validateTeamPermissions(permissions);
    if (!normalizedPermissions) {
      const error = new Error('All Team Leader permissions must be explicitly true or false.');
      error.statusCode = 400;
      throw error;
    }
    const cid = String(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);
    if (!teamId) throw serviceError('Choose a team before configuring its permissions.', 400);
    const team = await prisma.companyServiceTeam.findFirst({
      where: { id: parseEntityId(teamId, 'Team'), companyId: cid, serviceId: service.id },
    });
    if (!team?.headEmployeeId) {
      const error = new Error('Assign an active Team Leader before configuring team permissions.');
      error.statusCode = 400;
      throw error;
    }
    const currentHead = await prisma.companyEmployee.findUnique({ where: { id: team.headEmployeeId } });
    await prisma.companyEmployee.update({
      where: { id: team.headEmployeeId },
      data: {
        accessRole: 'TEAM_LEADER',
        permissions: {
          ...normalizedPermissions,
          featureAccess: currentHead?.permissions?.featureAccess || { moduleIds: [], subModuleIds: [] },
        },
      },
    });
    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_SERVICE_TEAM',
      entityId: team.id,
      newValue: { service: service.code, headId: team.headEmployeeId.toString(), permissions: normalizedPermissions },
      reason: `Updated Team Leader permissions for "${service.name}" in company #${cid}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.getServiceTeam(companyId, serviceCodeOrId, { role: 'COMPANY_ADMIN' }, team.id.toString());
  },

  async assignCompanyEmployee(companyId, employeeId, { serviceCode, teamId, accessRole = 'EMPLOYEE', permissions } = {}, meta = {}, actor) {
    const cid = String(companyId);
    const eid = parseEntityId(employeeId, 'Employee');
    if (!['SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(accessRole)) {
      const error = new Error('Choose Team Leader or Employee as the access role.');
      error.statusCode = 400;
      throw error;
    }

    const employee = await prisma.companyEmployee.findFirst({
      where: { id: eid, companyId: cid },
      include: { team: true },
    });
    if (!employee) {
      const error = new Error('Employee not found for this company.');
      error.statusCode = 404;
      throw error;
    }
    assertTeamLeaderOwnsMember(actor, employee);
    if (accessRole !== 'EMPLOYEE' && employee.status !== 'ACTIVE') {
      throw serviceError('An inactive employee cannot be assigned as Team Leader.', 400);
    }

    const service = await this._resolveService(String(serviceCode || ''));
    if (!service || service.status !== 'ACTIVE') {
      const error = new Error(service ? 'The selected service is inactive.' : 'Service not found in catalogue.');
      error.statusCode = service ? 403 : 404;
      throw error;
    }
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) {
      const error = new Error('The selected service is not assigned to this company.');
      error.statusCode = 403;
      error.code = 'SERVICE_NOT_ASSIGNED';
      throw error;
    }
    let requestedTeamId = teamId || null;
    if (TEAM_LEADER_ROLES.includes(actor?.role)) {
      const team = await prisma.companyServiceTeam.findFirst({
        where: {
          companyId: cid,
          serviceId: service.id,
          headEmployeeId: String(actor.userId),
        },
        select: { id: true },
      });
      if (!team || teamId && String(teamId) !== team.id.toString() || accessRole !== 'EMPLOYEE') {
        throw serviceError('A Team Leader can only manage employees in their own team.', 403);
      }
      requestedTeamId = team.id.toString();
    }

    const normalizedPermissions = accessRole === 'EMPLOYEE'
      ? (permissions ? normalizeTeamPermissions(permissions) : null)
      : validateTeamPermissions(permissions);
    if (accessRole !== 'EMPLOYEE' && (!normalizedPermissions || !permissions?.featureAccess)) {
      throw serviceError('Team Leader permissions must include explicit team actions and feature access.', 400);
    }
    const availableServiceModules = await getAvailableServiceModules(cid, service, serviceAccess);
    if (normalizedPermissions && !validateFeatureAccess(normalizedPermissions, availableServiceModules)) {
      throw serviceError('Feature permissions must be within the company-approved service access.', 400);
    }
    await assertTeamLeaderDelegationScope(cid, actor, normalizedPermissions, availableServiceModules);

    const updated = await prisma.$transaction(async (tx) => {
      const targetTeamId = requestedTeamId || employee.teamId?.toString();
      if (!targetTeamId) throw serviceError('Create and select a team before assigning this employee.', 400);
      const targetTeam = await tx.companyServiceTeam.findFirst({
        where: { id: parseEntityId(targetTeamId, 'Team'), companyId: cid, serviceId: service.id },
      });
      if (!targetTeam) throw serviceError('Choose a team belonging to the selected service.', 400);
      const moving = employee.teamId !== targetTeam.id;
      if (accessRole !== 'EMPLOYEE' && targetTeam.headEmployeeId && targetTeam.headEmployeeId !== eid) {
        throw serviceError('This team already has a Team Leader.', 409, 'TEAM_LEADER_EXISTS');
      }

      if (moving && employee.teamId) {
        await tx.companyServiceTeam.updateMany({
          where: { id: employee.teamId, headEmployeeId: eid },
          data: { headEmployeeId: null },
        });
      }
      if (moving && !normalizedPermissions) {
        await tx.companyEmployee.update({
          where: { id: eid },
          data: { permissions: null },
        });
      }
      if (accessRole !== 'EMPLOYEE') {
        if (targetTeam.headEmployeeId !== eid) {
          const claimedHead = await tx.companyServiceTeam.updateMany({
            where: { id: targetTeam.id, headEmployeeId: null },
            data: { headEmployeeId: eid },
          });
          if (claimedHead.count !== 1) {
            throw serviceError('This team already has a Team Leader.', 409, 'TEAM_LEADER_EXISTS');
          }
        }
      } else if (targetTeam.headEmployeeId === eid) {
        await tx.companyServiceTeam.update({
          where: { id: targetTeam.id },
          data: { headEmployeeId: null },
        });
      }

      const permissionsToStore = employee.permissions?.memberOwnerId
        ? {
          ...(normalizedPermissions || normalizeTeamPermissions(null)),
          memberOwnerId: String(employee.permissions.memberOwnerId),
        }
        : normalizedPermissions;

      return tx.companyEmployee.update({
        where: { id: eid },
        data: {
          teamId: targetTeam.id,
          accessRole: accessRole === 'SERVICE_HEAD' ? 'TEAM_LEADER' : accessRole,
          permissions: permissionsToStore,
        },
        include: {
          department: { include: { service: true } },
          team: { include: { service: true } },
        },
      });
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: updated.id,
      newValue: { service: service.code, accessRole, permissions: normalizedPermissions },
      reason: `Assigned employee "${updated.name}" to ${service.name} as ${accessRole}`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatEmployee(updated);
  },

  /**
   * Update work / service permissions for an existing employee in a team
   */
  async updateEmployeePermissions(companyId, employeeId, data, meta = {}, actor = null) {
    const cid = String(companyId);
    const eid = parseEntityId(employeeId, 'Employee');
    const employee = await prisma.companyEmployee.findFirst({
      where: { id: eid, companyId: cid },
      include: {
        team: { include: { service: true } },
        department: { include: { service: true } },
      },
    });
    if (!employee) {
      throw serviceError('Employee not found for this company.', 404);
    }
    assertTeamLeaderOwnsMember(actor, employee);

    const service = employee.team?.service || employee.department?.service;
    if (!service) {
      throw serviceError('Employee is not associated with an active service department.', 400);
    }
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { adminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) {
      throw serviceError('The service is not assigned to this company.', 403);
    }

    const availableModules = await getAvailableServiceModules(cid, service, serviceAccess);
    const normalizedPermissions = normalizeTeamPermissions(data.permissions);

    if (
      normalizedPermissions &&
      !validateFeatureAccess(normalizedPermissions, availableModules)
    ) {
      throw serviceError('Feature permissions must be within the company-approved service access.', 400);
    }
    await assertTeamLeaderDelegationScope(cid, actor, normalizedPermissions, availableModules);

    const permissionsToStore = employee.permissions?.memberOwnerId
      ? {
        ...(normalizedPermissions || normalizeTeamPermissions(null)),
        memberOwnerId: String(employee.permissions.memberOwnerId),
      }
      : normalizedPermissions;

    const updated = await prisma.companyEmployee.update({
      where: { id: eid },
      data: {
        permissions: permissionsToStore,
      },
      include: {
        department: { include: { service: true } },
        team: { include: { service: true } },
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: updated.id,
      newValue: { permissions: normalizedPermissions },
      reason: `Updated work permissions for employee "${updated.name}"`,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return formatEmployee(updated);
  },

  /**
   * Get departments under a specific assigned service
   */
  async getDepartmentsByService(companyId, serviceCodeOrId) {
    const cid = String(companyId);
    const service = await this._resolveService(serviceCodeOrId);

    if (!service) {
      const error = new Error('Service not found in catalogue');
      error.statusCode = 404;
      throw error;
    }

    // MANDATORY REQUIREMENT: Verify service is globally ACTIVE
    if (service.status === 'INACTIVE') {
      const error = new Error(`Access Denied: Service "${service.name}" is currently deactivated by Super Admin.`);
      error.statusCode = 403;
      error.code = 'SERVICE_INACTIVE';
      throw error;
    }

    // MANDATORY REQUIREMENT: Verify service is assigned to the company by Super Admin
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: {
        adminId: cid,
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
   * Get all departments for a company across all assigned active services
   */
  async getAllDepartmentsForCompany(companyId, includeInactiveServices = false) {
    const cid = String(companyId);
    const where = { companyId: cid };
    if (!includeInactiveServices) {
      where.service = { status: 'ACTIVE' };
    }
    const departments = await prisma.department.findMany({
      where,
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
    const cid = String(companyId);

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

    // MANDATORY REQUIREMENT: Verify parent service is globally ACTIVE
    if (service.status === 'INACTIVE') {
      const error = new Error(`Department creation denied: Service "${service.name}" is currently deactivated by Super Admin.`);
      error.statusCode = 403;
      error.code = 'SERVICE_INACTIVE';
      throw error;
    }

    // 3. MANDATORY REQUIREMENT: Server-side validation of assigned-service permission
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: {
        adminId: cid,
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
      const candidateHeadId = String(data.headId || data.head_id);
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
    const cid = String(companyId);
    const did = String(departmentId);

    const existingDept = await prisma.department.findFirst({
      where: { id: did, companyId: cid },
      include: { service: true, head: true },
    });

    if (!existingDept) {
      const error = new Error('Department not found for this company');
      error.statusCode = 404;
      throw error;
    }

    if (existingDept.service?.status === 'INACTIVE') {
      const error = new Error(`Operation denied: Service "${existingDept.service.name}" is currently deactivated by Super Admin.`);
      error.statusCode = 403;
      error.code = 'SERVICE_INACTIVE';
      throw error;
    }

    let validatedHeadId = existingDept.headId;
    if (data.headId !== undefined || data.head_id !== undefined) {
      const hId = data.headId || data.head_id;
      if (hId === null || hId === '') {
        validatedHeadId = null;
      } else {
        const candidateHeadId = String(hId);
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
    const cid = String(companyId);
    const did = String(departmentId);

    const existingDept = await prisma.department.findFirst({
      where: { id: did, companyId: cid },
      include: { service: true },
    });

    if (!existingDept) {
      const error = new Error('Department not found for this company');
      error.statusCode = 404;
      throw error;
    }

    if (existingDept.service?.status === 'INACTIVE') {
      const error = new Error(`Operation denied: Service "${existingDept.service.name}" is currently deactivated by Super Admin.`);
      error.statusCode = 403;
      error.code = 'SERVICE_INACTIVE';
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
    const cid = String(companyId);
    const did = String(departmentId);

    const existingDept = await prisma.department.findFirst({
      where: { id: did, companyId: cid },
      include: { service: true },
    });

    if (!existingDept) {
      const error = new Error('Department not found for this company');
      error.statusCode = 404;
      throw error;
    }

    if (existingDept.service?.status === 'INACTIVE') {
      const error = new Error(`Operation denied: Service "${existingDept.service.name}" is currently deactivated by Super Admin.`);
      error.statusCode = 403;
      error.code = 'SERVICE_INACTIVE';
      throw error;
    }

    // Verify all selected employees belong to the same company.
    const employeeIdList = employeeIds.map(String);
    const employees = await prisma.companyEmployee.findMany({
      where: { id: { in: employeeIdList } },
    });

    for (const emp of employees) {
      if (emp.companyId !== cid) {
        const error = new Error('Cross-company assignment forbidden: employee does not belong to this company');
        error.statusCode = 403;
        throw error;
      }
    }

    // Assign these employees to this department
    if (employeeIdList.length > 0) {
      await prisma.companyEmployee.updateMany({
        where: { id: { in: employeeIdList } },
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
