import prisma from '../config/prisma.js';
import { formatEmployee, formatDepartment } from '../utils/formatters.js';
import { hashPassword } from '../utils/hash.js';
import auditService from './audit.service.js';
import { validateTeamPermissions } from '../utils/team-permissions.js';
import { isUuid } from '../utils/uuid.js';

const TEAM_LEADER_ROLES = ['SERVICE_HEAD', 'TEAM_LEADER'];

function serviceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function parseEntityId(value, label) {
  if (!/^[1-9]\d*$/.test(String(value ?? ''))) {
    throw serviceError(`${label} must be a valid identifier.`, 400);
  }
  return BigInt(value);
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
      where: { clientAdminId: companyId, serviceId: service.id, isAllowed: true },
    }),
    prisma.clientSubModuleAccess.findMany({
      where: { clientAdminId: companyId, serviceId: service.id, isAllowed: true },
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
  const moduleIds = new Set(availableModules.filter((module) => module.fullAccess).map((module) => module.id));
  const subModuleIds = new Set(availableModules.flatMap((module) => module.subModules.map((subModule) => subModule.id)));
  return featureAccess.moduleIds.every((id) => moduleIds.has(id)) &&
    featureAccess.subModuleIds.every((id) => subModuleIds.has(id));
}

/**
 * Service for managing company employees and named teams under assigned services.
 * Enforces company boundary and Super Admin assigned-service isolation.
 */
export const departmentService = {
  /**
   * Get eligible employees for a company
   */
  async getCompanyEmployees(companyId, actor) {
    const cid = String(companyId);
    const where = { companyId: cid };
    if (actor?.role !== 'COMPANY_ADMIN') {
      const employeeId = String(actor?.userId || '');
      const team = await prisma.companyServiceTeam.findFirst({
        where: { companyId: cid, headEmployeeId: employeeId },
        select: { id: true },
      });
      if (!team) {
        throw serviceError('Only a company admin or a Team Leader with member-management access can view employees.', 403);
      }
      where.teamId = team.id;
    }
    const employees = await prisma.companyEmployee.findMany({
      where,
      include: {
        department: { include: { service: true } },
        team: { include: { service: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return employees.map(formatEmployee);
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
    const password = data.password;
    const serviceCode = data.serviceCode || data.serviceId;
    const accessRole = data.accessRole || 'EMPLOYEE';

    if (!name || !email || !serviceCode || typeof password !== 'string' || password.length < 8) {
      const error = new Error('Name, work email, assigned service, and a password of at least 8 characters are required.');
      error.statusCode = 400;
      throw error;
    }

    if (!['SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(accessRole)) {
      throw serviceError('Choose Team Leader or Employee as the access role.', 400);
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
    let requestedTeamId = data.teamId || null;
    if (TEAM_LEADER_ROLES.includes(actor?.role)) {
      const team = await prisma.companyServiceTeam.findFirst({
        where: {
          companyId: cid,
          serviceId: service.id,
          headEmployeeId: String(actor.userId),
        },
        select: { id: true },
      });
      if (!team || data.teamId && String(data.teamId) !== team.id.toString() || accessRole !== 'EMPLOYEE') {
        throw serviceError('A Team Leader can only add employees to their own team.', 403);
      }
      requestedTeamId = team.id.toString();
    }

    const requestedPermissions = accessRole === 'EMPLOYEE'
      ? null
      : validateTeamPermissions(data.permissions);
    if (accessRole !== 'EMPLOYEE' && (!requestedPermissions || !data.permissions?.featureAccess)) {
      throw serviceError('Team Leader permissions must include explicit team actions and feature access.', 400);
    }
    if (
      requestedPermissions &&
      !validateFeatureAccess(
        requestedPermissions,
        await getAvailableServiceModules(cid, service, serviceAccess)
      )
    ) {
      throw serviceError('Team Leader feature permissions must be within the company-approved service access.', 400);
    }

    if (!requestedTeamId) {
      throw serviceError('Create and select a team before adding an employee.', 400);
    }

    const passwordHash = hashPassword(password);
    let employee;
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

        const created = await tx.companyEmployee.create({
          data: {
            companyId: cid,
            teamId: team.id,
            name,
            email,
            role: typeof data.role === 'string' && data.role.trim() ? data.role.trim() : 'Team Member',
            accessRole: accessRole === 'SERVICE_HEAD' ? 'TEAM_LEADER' : accessRole,
            permissions: requestedPermissions,
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
        role: employee.role,
        accessRole: employee.accessRole,
        service: service.code,
        teamId: employee.teamId.toString(),
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
    const cid = BigInt(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service) throw serviceError('Service not found in catalogue.', 404);
    if (service.status !== 'ACTIVE') {
      throw serviceError(`Service "${service.name}" is currently deactivated by Super Admin.`, 403, 'SERVICE_INACTIVE');
    }
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { clientAdminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) {
      throw serviceError(`Service "${service.name}" is not assigned to this company.`, 403, 'SERVICE_NOT_ASSIGNED');
    }

    const where = { companyId: cid, serviceId: service.id };
    if (TEAM_LEADER_ROLES.includes(actor?.role)) where.headEmployeeId = BigInt(actor.userId);
    const [teams, availableModules] = await Promise.all([
      prisma.companyServiceTeam.findMany({
        where,
        include: {
          head: true,
          employees: {
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
    ]);
    const visibleTeams = teams.filter(
      (team) => team.name.trim().toLocaleLowerCase() !== `${service.name} team`.toLocaleLowerCase() ||
        team.headEmployeeId ||
        team.employees.length > 0
    );
    return {
      service: { id: service.id.toString(), code: service.code, name: service.name },
      availableModules,
      teams: visibleTeams.map((team) => ({
        id: team.id.toString(),
        name: team.name,
        head: team.head ? formatEmployee({ ...team.head, team: { service, headEmployeeId: team.headEmployeeId } }) : null,
        employees: team.employees.map(formatEmployee),
      })),
    };
  },

  async createServiceTeam(companyId, serviceCodeOrId, name, meta = {}) {
    const cid = BigInt(companyId);
    const service = await this._resolveService(String(serviceCodeOrId));
    if (!service || service.status !== 'ACTIVE') {
      throw serviceError(service ? 'The selected service is inactive.' : 'Service not found in catalogue.', service ? 403 : 404);
    }
    const serviceAccess = await prisma.clientServiceAccess.findFirst({
      where: { clientAdminId: cid, serviceId: service.id, isAllowed: true },
    });
    if (!serviceAccess) throw serviceError('This service is not assigned to the company.', 403, 'SERVICE_NOT_ASSIGNED');
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > 150) {
      throw serviceError('Team name must contain between 1 and 150 characters.', 400);
    }
    if (cleanName.toLocaleLowerCase() === `${service.name} team`.toLocaleLowerCase()) {
      throw serviceError('A service is not a team. Choose a distinct team name.', 400);
    }

    let team;
    try {
      team = await prisma.companyServiceTeam.create({
        data: { companyId: cid, serviceId: service.id, name: cleanName },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
      throw serviceError('A team with this name already exists for the selected service.', 409, 'TEAM_NAME_EXISTS');
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
      serviceId: team.serviceId.toString(),
      companyId: team.companyId.toString(),
    };
  },

  async getServiceTeam(companyId, serviceCodeOrId, actor, teamId = null) {
    const cid = BigInt(companyId);
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
        const error = new Error('This service team is outside your assigned service.');
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
    return {
      id: team.id.toString(),
      name: team.name,
      service: { id: service.id.toString(), code: service.code, name: service.name },
      head: team.head
        ? formatEmployee({ ...team.head, team: { service, headEmployeeId: team.headEmployeeId } })
        : null,
      employees: team.employees.map(formatEmployee),
    };
  },

  async setServiceTeamHead(companyId, serviceCodeOrId, headId, meta = {}, teamId = null) {
    const cid = BigInt(companyId);
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

  async setServiceTeamPermissions(companyId, serviceCodeOrId, permissions, meta = {}, teamId = null) {
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
    const cid = BigInt(companyId);
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

    const normalizedPermissions = accessRole === 'EMPLOYEE' ? null : validateTeamPermissions(permissions);
    if (accessRole !== 'EMPLOYEE' && (!normalizedPermissions || !permissions?.featureAccess)) {
      throw serviceError('Team Leader permissions must include explicit team actions and feature access.', 400);
    }
    if (normalizedPermissions && !validateFeatureAccess(
      normalizedPermissions,
      await getAvailableServiceModules(cid, service, serviceAccess)
    )) {
      throw serviceError('Team Leader feature permissions must be within the company-approved service access.', 400);
    }

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
      if (moving || (targetTeam.headEmployeeId === eid && accessRole === 'EMPLOYEE')) {
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

      return tx.companyEmployee.update({
        where: { id: eid },
        data: {
          teamId: targetTeam.id,
          accessRole: accessRole === 'SERVICE_HEAD' ? 'TEAM_LEADER' : accessRole,
          permissions: normalizedPermissions,
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
      newValue: { service: service.code, accessRole },
      reason: `Assigned employee "${updated.name}" to ${service.name} as ${accessRole}`,
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
