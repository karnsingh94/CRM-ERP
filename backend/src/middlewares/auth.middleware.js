import { extractToken, verifyToken } from '../utils/token.js';
import { isUuid } from '../utils/uuid.js';

/**
 * Optional or passive authentication middleware
 * Attaches req.user if a valid token is present
 */
export function authenticate(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      req.token = token;
    }
  }
  next();
}

/**
 * Mandatory authentication guard middleware
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to proceed.',
      code: 'UNAUTHENTICATED',
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Session has expired or is invalid. Please log in again.',
      code: 'SESSION_EXPIRED',
    });
  }

  req.user = decoded;
  req.token = token;
  next();
}

/**
 * Guard restricted strictly to Super Admin
 */
export function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Platform Super Admin privileges required.',
        code: 'FORBIDDEN_SUPER_ADMIN_ONLY',
      });
    }
    next();
  });
}

/**
 * Guard restricted to Company Users (Company Admin, Department Head, Employee)
 */
export function requireCompanyUser(req, res, next) {
  requireAuth(req, res, () => {
    const allowed = ['COMPANY_ADMIN', 'DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'];
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Company user privileges required.',
        code: 'FORBIDDEN_COMPANY_USER_ONLY',
      });
    }
    next();
  });
}

/**
 * Guard restricted to the tenant's Company Admin account
 */
export function requireCompanyAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'COMPANY_ADMIN' || !req.user.companyId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Company Admin privileges required.',
        code: 'FORBIDDEN_COMPANY_ADMIN_ONLY',
      });
    }
    next();
  });
}

export function requireServiceTeamPermission(permission) {
  return async (req, res, next) => {
    if (req.user?.role === 'COMPANY_ADMIN' && req.user.companyId) return next();
    if (!['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER'].includes(req.user?.role) || !req.user.userId || !req.user.companyId) {
      return res.status(403).json({
        success: false,
        code: 'TEAM_PERMISSION_REQUIRED',
        message: 'Access denied: the required Department Head or Team Leader permission is not assigned.',
      });
    }

    try {
      const { prisma } = await import('../config/prisma.js');
      const employee = await prisma.companyEmployee.findFirst({
        where: {
          id: String(req.user.userId),
          companyId: String(req.user.companyId),
          status: 'ACTIVE',
        },
        select: { permissions: true, accessRole: true, team: { select: { headEmployeeId: true } } },
      });
      if (!employee) {
        return res.status(403).json({
          success: false,
          code: 'TEAM_PERMISSION_REQUIRED',
          message: 'Access denied: active employee not found.',
        });
      }

      const requiredPermissions = Array.isArray(permission) ? permission : [permission];
      if (
        employee.accessRole === 'DEPARTMENT_HEAD' ||
        employee.accessRole === 'SERVICE_HEAD' ||
        employee.team?.headEmployeeId === String(req.user.userId)
      ) {
        if (requiredPermissions.some((key) => employee?.permissions?.[key] === true)) return next();
      }

      return res.status(403).json({
        success: false,
        code: 'TEAM_PERMISSION_REQUIRED',
        message: 'Access denied: the required Department Head or Team Leader permission is not assigned.',
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Guard for mutations to the team structure itself.
 * Team Leaders may manage permitted members/work, but they cannot create,
 * edit, activate/deactivate, or reconfigure teams.
 */
export function requireTeamStructureManager(req, res, next) {
  requireAuth(req, res, async () => {
    if (req.user?.role === 'COMPANY_ADMIN' && req.user.companyId) return next();

    if (!['DEPARTMENT_HEAD', 'SERVICE_HEAD'].includes(req.user?.role) || !req.user.userId || !req.user.companyId) {
      return res.status(403).json({
        success: false,
        code: 'TEAM_STRUCTURE_MANAGER_REQUIRED',
        message: 'Access denied: only the Company Admin or Department Head can manage team structure and status.',
      });
    }

    try {
      const { prisma } = await import('../config/prisma.js');
      const employee = await prisma.companyEmployee.findFirst({
        where: {
          id: String(req.user.userId),
          companyId: String(req.user.companyId),
          status: 'ACTIVE',
          accessRole: { in: ['DEPARTMENT_HEAD', 'SERVICE_HEAD'] },
        },
        select: { permissions: true },
      });

      if (!employee || employee.permissions?.manageTeams === false) {
        return res.status(403).json({
          success: false,
          code: 'TEAM_STRUCTURE_MANAGER_REQUIRED',
          message: 'Access denied: team-management permission is required.',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  });
}

/**
 * Tenant Isolation & Company Ownership Guard
 * Verifies that the authenticated user belongs to the target companyId
 */
export async function validateCompanyAccess(req, res, next) {
  try {
    const { companyId } = req.params;
    if (!companyId) return next();

    // Verify format
    if (!isUuid(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be a UUID.',
      });
    }

    // Check passive auth token if not already run
    if (!req.user) {
      const token = extractToken(req);
      if (token) {
        const decoded = verifyToken(token);
        if (decoded) req.user = decoded;
      }
    }

    // If authenticated user is a company user, enforce tenant isolation
    if (req.user && req.user.role !== 'SUPER_ADMIN') {
      if (req.user.companyId && String(req.user.companyId) !== String(companyId)) {
        return res.status(403).json({
          success: false,
          code: 'TENANT_ISOLATION_VIOLATION',
          message: 'Access denied: You do not have permission to access resources belonging to another company.',
        });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Submodule / Feature Screen Access Guard
 * Enforces effective availability:
 * Service is ACTIVE && Module is ACTIVE && Submodule is ACTIVE && Company Assigned
 */
export function validateSubModuleAccess(subModuleCodeOrRoute) {
  return async (req, res, next) => {
    try {
      const { prisma } = await import('../config/prisma.js');
      if (!req.user) {
        const token = extractToken(req);
        if (token) req.user = verifyToken(token);
      }
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Authentication is required to access this feature.',
        });
      }

      const subModule = await prisma.subModule.findFirst({
        where: {
          OR: [
            { code: subModuleCodeOrRoute },
            { route: subModuleCodeOrRoute },
            { route: `/crm/${subModuleCodeOrRoute}` },
          ],
        },
        include: {
          module: {
            include: {
              service: true,
            },
          },
        },
      });

      if (!subModule) {
        return res.status(404).json({
          success: false,
          code: 'SUBMODULE_NOT_FOUND',
          message: 'The requested feature screen was not found.',
        });
      }

      // Check parent service status
      if (subModule.module?.service?.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          code: 'SERVICE_INACTIVE',
          message: `Access denied: Parent service "${subModule.module?.service?.name || 'Unknown'}" is currently inactive.`,
        });
      }

      // Check parent module status
      if (subModule.module?.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          code: 'MODULE_INACTIVE',
          message: `Access denied: Parent module "${subModule.module?.name || 'Unknown'}" is currently inactive.`,
        });
      }

      // Check submodule status
      if (subModule.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          code: 'SUBMODULE_INACTIVE',
          message: `Access denied: Feature screen "${subModule.name}" is currently deactivated by Super Admin.`,
        });
      }

      // Tenant isolation & assignment check if company context exists
      const targetCompanyId = req.params?.companyId || req.user?.companyId;
      if (req.user.role !== 'SUPER_ADMIN' && !targetCompanyId) {
        return res.status(403).json({
          success: false,
          code: 'COMPANY_CONTEXT_REQUIRED',
          message: 'Access denied: A company workspace is required for this feature.',
        });
      }
      if (targetCompanyId && req.user?.role !== 'SUPER_ADMIN') {
        const companyIdUuid = String(targetCompanyId).toLowerCase();
        if (String(req.user.companyId).toLowerCase() !== companyIdUuid) {
          return res.status(403).json({
            success: false,
            code: 'TENANT_ISOLATION_VIOLATION',
            message: 'Access denied: You do not have permission to access this company.',
          });
        }

        if (!['COMPANY_ADMIN', 'DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN_COMPANY_USER_ONLY',
            message: 'Access denied: Company user privileges are required.',
          });
        }

        const serviceAccess = await prisma.clientServiceAccess.findFirst({
          where: {
            adminId: companyIdUuid,
            serviceId: subModule.serviceId,
            isAllowed: true,
          },
        });

        if (!serviceAccess) {
          return res.status(403).json({
            success: false,
            code: 'SERVICE_NOT_ASSIGNED',
            message: `Access denied: Service "${subModule.module?.service?.name}" is not assigned to this company.`,
          });
        }

        if (['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(req.user.role)) {
          const employee = await prisma.companyEmployee.findFirst({
            where: {
              id: String(req.user.userId),
              companyId: companyIdUuid,
              status: 'ACTIVE',
            },
            include: { department: true, team: true },
          });
          const assignedServiceId = employee?.department?.serviceId || employee?.team?.serviceId;
          if (!assignedServiceId || String(assignedServiceId) !== String(subModule.serviceId)) {
            return res.status(403).json({
              success: false,
              code: 'SERVICE_SCOPE_VIOLATION',
              message: 'Access denied: This feature is outside your assigned service.',
            });
          }
          const isDepartmentHead =
            ['DEPARTMENT_HEAD', 'SERVICE_HEAD'].includes(employee.accessRole) ||
            ['DEPARTMENT_HEAD', 'SERVICE_HEAD'].includes(req.user.role);
          const isTeamLeader = employee.team?.headEmployeeId === employee.id;
          if (isDepartmentHead || isTeamLeader) {
            const featureAccess = employee.permissions?.featureAccess || {};
            const permittedModuleIds = Array.isArray(featureAccess.moduleIds)
              ? featureAccess.moduleIds.map(String)
              : [];
            const permittedSubModuleIds = Array.isArray(featureAccess.subModuleIds)
              ? featureAccess.subModuleIds.map(String)
              : [];
            const hasFeatureAccess =
              permittedModuleIds.includes(subModule.moduleId.toString()) ||
              permittedSubModuleIds.includes(subModule.id.toString());
            if (!hasFeatureAccess) {
              return res.status(403).json({
                success: false,
                code: 'TEAM_FEATURE_PERMISSION_REQUIRED',
                message: 'Access denied: this feature is not assigned to your role.',
              });
            }
            if (
              !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
              employee.permissions?.manageServiceRecords !== true
            ) {
              return res.status(403).json({
                success: false,
                code: 'TEAM_PERMISSION_REQUIRED',
                message: 'Access denied: your role does not have permission to manage service records.',
              });
            }
          } else {
            // Regular EMPLOYEE: both viewing and mutations are limited to the
            // exact module/submodule scope delegated by the Team Leader.
            const featureAccess = employee.permissions?.featureAccess || {};
            const permittedModuleIds = Array.isArray(featureAccess.moduleIds)
              ? featureAccess.moduleIds.map(String)
              : [];
            const permittedSubModuleIds = Array.isArray(featureAccess.subModuleIds)
              ? featureAccess.subModuleIds.map(String)
              : [];
            const hasFeatureAccess =
              permittedModuleIds.includes(subModule.moduleId.toString()) ||
              permittedSubModuleIds.includes(subModule.id.toString());
            if (!hasFeatureAccess) {
              return res.status(403).json({
                success: false,
                code: 'EMPLOYEE_FEATURE_RESTRICTED',
                message: `Access denied: "${subModule.name}" is not assigned to your employee account.`,
              });
            }
          }
        }

        if (!serviceAccess.isFullService) {
          const moduleAccess = await prisma.clientModuleAccess.findFirst({
            where: {
              adminId: companyIdUuid,
              serviceId: subModule.serviceId,
              moduleId: subModule.moduleId,
              isAllowed: true,
            },
          });
          if (!moduleAccess) {
            return res.status(403).json({
              success: false,
              code: 'MODULE_NOT_ASSIGNED',
              message: `Access denied: Module "${subModule.module?.name}" is not assigned to this company.`,
            });
          }

          if (moduleAccess.accessMode !== 'FULL') {
            const subModuleAccess = await prisma.clientSubModuleAccess.findFirst({
              where: {
                adminId: companyIdUuid,
                serviceId: subModule.serviceId,
                moduleId: subModule.moduleId,
                subModuleId: subModule.id,
                isAllowed: true,
              },
            });
            if (!subModuleAccess) {
              return res.status(403).json({
                success: false,
                code: 'SUBMODULE_NOT_ASSIGNED',
                message: `Access denied: Feature screen "${subModule.name}" is not assigned to this company.`,
              });
            }
          }
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export default {
  authenticate,
  requireAuth,
  requireSuperAdmin,
  requireCompanyUser,
  requireCompanyAdmin,
  requireServiceTeamPermission,
  validateCompanyAccess,
  validateSubModuleAccess,
};
