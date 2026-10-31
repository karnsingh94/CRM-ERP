import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { normalizeClientIp } from '../utils/clientIp.js';

/**
 * Remove sensitive credentials from audit logs
 */
function sanitizeAuditPayload(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return data;
    }
  }

  if (typeof data !== 'object') return data;

  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveKeys = ['password', 'passwordhash', 'token', 'secret', 'apikey', 'key', 'credential', 'auth', 'access_token'];

  for (const k of Object.keys(sanitized)) {
    const lowerKey = k.toLowerCase();
    if (sensitiveKeys.some(s => lowerKey.includes(s))) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof sanitized[k] === 'object' && sanitized[k] !== null) {
      sanitized[k] = sanitizeAuditPayload(sanitized[k]);
    }
  }

  return JSON.stringify(sanitized);
}

export const auditService = {
  /**
   * Universal audit logger supporting both Super Admin and Company Tenants
   */
  async logAction({
    companyId = null,
    actor = null,
    action,
    serviceCode = null,
    moduleCode = null,
    entityType = null,
    entityId = null,
    beforeState = null,
    afterState = null,
    reason = null,
    req = null,
  }) {
    try {
      let ipAddress = '127.0.0.1';
      let userAgent = 'System / API';

      if (req) {
        ipAddress = normalizeClientIp(req.ip || req.socket?.remoteAddress) || req.meta?.ip || '127.0.0.1';
        userAgent = req.headers?.['user-agent'] || req.meta?.userAgent || 'API Client';
      }

      let actorId = null;
      let userId = null;
      let userName = null;

      if (actor) {
        if (typeof actor === 'string') {
          userName = actor;
        } else if (actor.role === 'SUPER_ADMIN') {
          actorId = String(actor.id || actor.userId || 'super-admin');
          userName = actor.name || 'Super Admin';
        } else {
          userId = String(actor.userId || actor.id || 'company-user');
          userName = actor.name || actor.organizationName || 'User';
        }
      }

      const resolvedEntityType = entityType || (action ? String(action).split('_')[0] : 'GENERAL');

      const log = await prisma.auditLog.create({
        data: {
          companyId: companyId ? String(companyId) : null,
          actorId,
          userId,
          userName: userName || 'System',
          serviceCode,
          moduleCode,
          action,
          entityType: resolvedEntityType,
          entityId: entityId ? String(entityId) : null,
          beforeState: sanitizeAuditPayload(beforeState),
          afterState: sanitizeAuditPayload(afterState),
          reason: reason ? String(reason).trim() : null,
          ipAddress: String(ipAddress).slice(0, 64),
          userAgent: String(userAgent).slice(0, 255),
        },
      });

      return log;
    } catch (err) {
      logger.error('Failed to write audit log:', err.message);
      return null;
    }
  },

  /**
   * Platform-level audit logs (Super Admin)
   */
  async getAuditLogs(limit = 100) {
    return prisma.auditLog.findMany({
      where: { companyId: null },
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 100,
    });
  },

  /**
   * Tenant-isolated company audit logs with filtering and pagination
   */
  async getCompanyAuditLogs(companyId, filters = {}) {
    const {
      serviceCode,
      moduleCode,
      action,
      entityType,
      entityId,
      userId,
      limit = 50,
      offset = 0,
    } = filters;

    const where = { companyId };

    if (serviceCode) where.serviceCode = serviceCode;
    if (moduleCode) where.moduleCode = moduleCode;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit) || 50,
        skip: Number(offset) || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  },
};

export default auditService;
