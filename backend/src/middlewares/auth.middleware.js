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

export default {
  authenticate,
  requireAuth,
  requireSuperAdmin,
  requireCompanyUser,
  validateCompanyAccess,
};
