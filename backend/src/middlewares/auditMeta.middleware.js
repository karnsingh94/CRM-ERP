/**
 * Audit Metadata Middleware
 * Extracts client IP and User-Agent from incoming request and attaches to req.meta
 */
export function auditMetaMiddleware(req, res, next) {
  req.meta = {
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'API Client',
  };
  next();
}

export default auditMetaMiddleware;
