/**
 * Action-Level Permission & Segregation of Duties (SoD) Middleware
 */

export function requireAction(actionName, submoduleCode) {
  return async (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.',
      });
    }

    // Platform Super Admin and Company Admin possess all action rights
    if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') {
      return next();
    }

    // Department Heads / Service Heads possess standard operational rights
    if (['DEPARTMENT_HEAD', 'SERVICE_HEAD'].includes(user.role)) {
      return next();
    }

    // For employees, check granular action permissions
    try {
      const { prisma } = await import('../config/prisma.js');
      const employee = await prisma.companyEmployee.findFirst({
        where: {
          id: String(user.userId || user.id),
          companyId: String(user.companyId),
          status: 'ACTIVE',
        },
        select: { permissions: true },
      });

      if (!employee) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_USER_INACTIVE',
          message: 'Access denied: Employee record inactive or not found.',
        });
      }

      const permissions = employee.permissions || {};
      const actionPerms = permissions.actionPermissions || {};

      // If specific submodule actions configured, check them
      if (submoduleCode && Array.isArray(actionPerms[submoduleCode])) {
        if (!actionPerms[submoduleCode].includes(actionName)) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN_ACTION_NOT_PERMITTED',
            message: `Access denied: You do not have permission to perform action "${actionName}" on ${submoduleCode}.`,
          });
        }
        return next();
      }

      // Default fallback rule for mutations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        if (permissions.manageServiceRecords === false) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN_MUTATION_RESTRICTED',
            message: 'Access denied: Mutation operations are restricted for your role.',
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Segregation of Duties (SoD) Guard:
 * Prevents document creators from approving or settling their own submissions.
 */
export function preventSelfApproval(getCreatorIdFn) {
  return async (req, res, next) => {
    const currentUserId = String(req.user?.userId || req.user?.id);

    try {
      let creatorId = null;
      if (typeof getCreatorIdFn === 'function') {
        creatorId = await getCreatorIdFn(req);
      } else if (req.body?.createdById) {
        creatorId = req.body.createdById;
      }

      if (creatorId && String(creatorId) === currentUserId) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_SELF_APPROVAL_PROHIBITED',
          message: 'Segregation of Duties Violation: You cannot approve or sign off on your own transaction.',
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export default {
  requireAction,
  preventSelfApproval,
};

