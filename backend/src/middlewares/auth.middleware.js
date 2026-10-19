import { extractToken, verifyToken } from '../utils/token.js';

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
    const allowed = ['COMPANY_ADMIN', 'DEPARTMENT_HEAD', 'EMPLOYEE'];
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
 * Tenant Isolation & Company Ownership Guard
 * Verifies that the authenticated user belongs to the target companyId
 */
export async function validateCompanyAccess(req, res, next) {
  try {
    const { companyId } = req.params;
    if (!companyId) return next();

    // Verify format
    try {
      BigInt(companyId);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Must be an integer identifier.',
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
        return next();
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
      if (targetCompanyId && req.user?.role !== 'SUPER_ADMIN') {
        const companyIdBig = BigInt(targetCompanyId);
        const serviceAccess = await prisma.clientServiceAccess.findFirst({
          where: {
            clientAdminId: companyIdBig,
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
  validateCompanyAccess,
  validateSubModuleAccess,
};
