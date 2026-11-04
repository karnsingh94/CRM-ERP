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

/**
 * Format audit records to support both camelCase and snake_case properties
 * and resolve human-friendly target/actor names.
 */
async function formatAuditRecords(rawLogs) {
  if (!rawLogs || !Array.isArray(rawLogs) || rawLogs.length === 0) return [];

  const serviceIds = new Set();
  const clientIds = new Set();
  const superAdminIds = new Set();
  const moduleIds = new Set();
  const subModuleIds = new Set();

  for (const l of rawLogs) {
    if (!l.entityId) continue;
    const type = String(l.entityType || '').toUpperCase();
    if (type.includes('SERVICE')) {
      serviceIds.add(l.entityId);
    } else if (type.includes('CLIENT') || type.includes('COMPANY') || type.includes('ACCESS')) {
      clientIds.add(l.entityId);
    } else if (type.includes('SUPER_ADMIN')) {
      superAdminIds.add(l.entityId);
    } else if (type.includes('SUB_MODULE')) {
      subModuleIds.add(l.entityId);
    } else if (type.includes('MODULE')) {
      moduleIds.add(l.entityId);
    } else {
      serviceIds.add(l.entityId);
      clientIds.add(l.entityId);
      superAdminIds.add(l.entityId);
    }
  }

  const [services, clients, superAdmins, modules, subModules] = await Promise.all([
    serviceIds.size > 0
      ? prisma.service.findMany({ where: { id: { in: Array.from(serviceIds) } }, select: { id: true, name: true, code: true } }).catch(() => [])
      : [],
    clientIds.size > 0
      ? prisma.clientAdmin.findMany({ where: { id: { in: Array.from(clientIds) } }, select: { id: true, organizationName: true, name: true } }).catch(() => [])
      : [],
    superAdminIds.size > 0
      ? prisma.superAdmin.findMany({ where: { id: { in: Array.from(superAdminIds) } }, select: { id: true, name: true, email: true } }).catch(() => [])
      : [],
    moduleIds.size > 0
      ? prisma.module.findMany({ where: { id: { in: Array.from(moduleIds) } }, select: { id: true, name: true } }).catch(() => [])
      : [],
    subModuleIds.size > 0
      ? prisma.subModule.findMany({ where: { id: { in: Array.from(subModuleIds) } }, select: { id: true, name: true } }).catch(() => [])
      : [],
  ]);

  const sMap = new Map((services || []).map(s => [s.id, s.name]));
  const cMap = new Map((clients || []).map(c => [c.id, c.organizationName || c.name]));
  const saMap = new Map((superAdmins || []).map(a => [a.id, a.name]));
  const mMap = new Map((modules || []).map(m => [m.id, m.name]));
  const smMap = new Map((subModules || []).map(sm => [sm.id, sm.name]));

  return rawLogs.map(l => {
    // 1. Resolve Target / Entity Name
    let target = null;
    if (l.entityId) {
      target = sMap.get(l.entityId) || cMap.get(l.entityId) || saMap.get(l.entityId) || mMap.get(l.entityId) || smMap.get(l.entityId);
    }

    if (!target && l.newValue) {
      try {
        const parsed = typeof l.newValue === 'string' ? JSON.parse(l.newValue) : l.newValue;
        if (parsed && typeof parsed === 'object') {
          target = parsed.name || parsed.organization || parsed.organizationName || parsed.companyName || parsed.title;
        }
      } catch {}
    }

    if (!target && l.oldValue) {
      try {
        const parsed = typeof l.oldValue === 'string' ? JSON.parse(l.oldValue) : l.oldValue;
        if (parsed && typeof parsed === 'object') {
          target = parsed.name || parsed.organization || parsed.organizationName || parsed.companyName || parsed.title;
        }
      } catch {}
    }

    if (!target && l.reason) {
      const matchQuote = l.reason.match(/\"([^\"]+)\"/);
      const matchFor = l.reason.match(/(?:service|module|for)\s+([A-Za-z0-9 &_-]+?)(?:\s+to|\s*$)/i);
      target = matchQuote ? matchQuote[1] : (matchFor ? matchFor[1] : null);
    }

    if (!target && l.entityId) {
      target = `#${String(l.entityId).slice(0, 8)}`;
    }

    // 2. Resolve Actor Name
    let actorName = l.userName || (l.superAdmin ? l.superAdmin.name : null);
    if (!actorName || actorName === 'System') {
      if (l.reason && l.reason.includes('Super Admin')) {
        actorName = 'Platform Super Admin';
      } else if (l.reason) {
        const m = l.reason.match(/(?:Company Admin|EMPLOYEE|TEAM_LEADER|DEPARTMENT_HEAD)\s+\"([^\"]+)\"/i);
        if (m) {
          actorName = m[1];
        } else {
          actorName = 'Platform Super Admin';
        }
      } else {
        actorName = 'Platform Super Admin';
      }
    }

    // 3. Resolve Details / Reason
    const details = l.reason || l.afterState || l.newValue || l.beforeState || l.oldValue || l.action || '—';

    // 4. Resolve Date ISO string
    let isoDate;
    try {
      isoDate = l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString();
    } catch {
      isoDate = new Date().toISOString();
    }

    const resolvedEntityType = l.entityType || 'SYSTEM';

    return {
      id: l.id,
      created_at: isoDate,
      createdAt: isoDate,
      actor_name: actorName,
      actorName: actorName,
      actor: actorName,
      userName: actorName,
      user_name: actorName,
      action: l.action || 'ACTION',
      entity_type: resolvedEntityType,
      entityType: resolvedEntityType,
      entity_id: l.entityId || null,
      entityId: l.entityId || null,
      entity_name: target || '—',
      entityName: target || '—',
      target: target || '—',
      targetName: target || '—',
      target_name: target || '—',
      details: details,
      reason: details,
      ip_address: l.ipAddress || '127.0.0.1',
      ipAddress: l.ipAddress || '127.0.0.1',
      user_agent: l.userAgent || 'API Client',
      userAgent: l.userAgent || 'API Client',
      service_code: l.serviceCode || null,
      serviceCode: l.serviceCode || null,
      module_code: l.moduleCode || null,
      moduleCode: l.moduleCode || null,
      company_id: l.companyId || null,
      companyId: l.companyId || null,
      before_state: l.beforeState || null,
      beforeState: l.beforeState || null,
      after_state: l.afterState || null,
      afterState: l.afterState || null,
      old_value: l.oldValue || null,
      oldValue: l.oldValue || null,
      new_value: l.newValue || null,
      newValue: l.newValue || null,
    };
  });
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
    details = null,
    ipAddress = null,
    userAgent = null,
    userId = null,
    actorId = null,
    userName = null,
    oldValue = null,
    newValue = null,
    req = null,
  } = {}) {
    try {
      let resolvedIp = ipAddress || '127.0.0.1';
      let resolvedUserAgent = userAgent || 'System / API';

      if (req) {
        resolvedIp = normalizeClientIp(req.ip || req.socket?.remoteAddress) || req.meta?.ip || resolvedIp;
        resolvedUserAgent = req.headers?.['user-agent'] || req.meta?.userAgent || resolvedUserAgent;
      }

      let resolvedActorId = actorId ? String(actorId) : null;
      let resolvedUserId = userId ? String(userId) : null;
      let resolvedUserName = userName || null;

      const effectiveActor = actor || (req && req.user ? req.user : null);

      if (effectiveActor) {
        if (typeof effectiveActor === 'string') {
          resolvedUserName = effectiveActor;
        } else if (effectiveActor.role === 'SUPER_ADMIN') {
          resolvedActorId = String(effectiveActor.id || effectiveActor.userId || 'super-admin');
          resolvedUserName = effectiveActor.name || 'Platform Super Admin';
        } else {
          resolvedUserId = String(effectiveActor.userId || effectiveActor.id || 'company-user');
          resolvedUserName = effectiveActor.name || effectiveActor.organizationName || 'User';
          // Foreign key actorId strictly belongs to SuperAdmin; ensure company actors don't populate actorId
          resolvedActorId = null;
        }
      } else if (resolvedActorId && resolvedActorId !== 'super-admin') {
        // Fallback safety if actorId was passed but actor object wasn't provided or wasn't super admin
        resolvedUserId = resolvedUserId || resolvedActorId;
        resolvedActorId = null;
      }

      if (!resolvedUserName) {
        if (reason && reason.includes('Super Admin')) {
          resolvedUserName = 'Platform Super Admin';
        } else {
          resolvedUserName = 'System';
        }
      }

      const resolvedEntityType = entityType || (action ? String(action).split('_')[0] : 'GENERAL');
      const resolvedReason = reason || details || null;
      const resolvedBefore = beforeState ?? oldValue;
      const resolvedAfter = afterState ?? newValue;

      const log = await prisma.auditLog.create({
        data: {
          companyId: companyId ? String(companyId) : null,
          actorId: resolvedActorId,
          userId: resolvedUserId,
          userName: resolvedUserName || 'System',
          serviceCode,
          moduleCode,
          action: action || 'ACTION',
          entityType: resolvedEntityType,
          entityId: entityId ? String(entityId) : null,
          beforeState: sanitizeAuditPayload(resolvedBefore),
          afterState: sanitizeAuditPayload(resolvedAfter),
          reason: resolvedReason ? String(resolvedReason).trim() : null,
          ipAddress: String(resolvedIp).slice(0, 64),
          userAgent: String(resolvedUserAgent).slice(0, 255),
        },
      });

      return log;
    } catch (err) {
      logger.error('Failed to write audit log:', err.message);
      return null;
    }
  },

  /**
   * Backward-compatible alias for existing service modules
   */
  async logAudit(params = {}) {
    return this.logAction(params);
  },

  /**
   * Platform-level audit logs (Super Admin)
   */
  async getAuditLogs(limit = 100, options = {}) {
    const where = {};
    if (options.companyId !== undefined && options.companyId !== null && options.companyId !== '') {
      where.companyId = String(options.companyId);
    }
    const rawLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 100, 500),
      include: { superAdmin: true },
    });
    return formatAuditRecords(rawLogs);
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

    const where = { companyId: String(companyId) };

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
        include: { superAdmin: true },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const formattedItems = await formatAuditRecords(items);

    return { items: formattedItems, total };
  },
};

export default auditService;
