import { normalizeClientIp } from '../utils/clientIp.js';

/**
 * Audit Metadata Middleware
 * Extracts client IP and User-Agent from incoming request and attaches to req.meta
 */
export function auditMetaMiddleware(req, res, next) {
  req.meta = {
    ip: normalizeClientIp(req.ip || req.socket?.remoteAddress) || 'Unknown',
    userAgent: req.headers['user-agent'] || 'API Client',
  };
  next();
}

export default auditMetaMiddleware;
