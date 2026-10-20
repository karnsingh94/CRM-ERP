import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { normalizeClientIp } from '../utils/clientIp.js';

function getEntityName(log) {
  for (const value of [log.newValue, log.oldValue]) {
    if (!value) continue;

    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (typeof parsed?.name === 'string' && parsed.name.trim()) {
        return parsed.name.trim();
      }
    } catch {
      // Values that are not JSON do not provide a display name.
    }
  }

  return log.entityId ? `#${log.entityId}` : '—';
}

/**
 * Service for logging and retrieving audit trail entries
 */
export const auditService = {
  /**
   * Retrieve latest audit logs
   */
  async getAuditLogs(limit = 100) {
    const logs = await prisma.auditLog.findMany({
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { superAdmin: { select: { id: true, name: true, email: true } } },
    });

    return logs.map((l) => ({
      id: l.id.toString(),
      actor_id: l.actorId ? l.actorId.toString() : null,
      actor_name: l.superAdmin?.name || 'System / Platform Admin',
      action: l.action,
      entity_type: l.entityType,
      entity_id: l.entityId ? l.entityId.toString() : null,
      entity_name: getEntityName(l),
      old_value: l.oldValue,
      new_value: l.newValue,
      reason: l.reason,
      ip_address: normalizeClientIp(l.ipAddress) || 'Unknown',
      user_agent: l.userAgent,
      created_at: l.createdAt,
      createdAt: l.createdAt,
      details: l.reason || `${l.action} ${l.entityType}`,
    }));
  },

  /**
   * Log an audit event
   */
  async logAudit({
    action,
    entityType,
    entityId = null,
    oldValue = null,
    newValue = null,
    reason = null,
    ipAddress = 'Unknown',
    userAgent = null,
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId: entityId ? BigInt(entityId) : null,
          oldValue: typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue,
          newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : newValue,
          reason,
          ipAddress: normalizeClientIp(ipAddress) || 'Unknown',
          userAgent,
        },
      });
    } catch (err) {
      logger.error('Failed to log audit event:', err);
    }
  },
};

export default auditService;
