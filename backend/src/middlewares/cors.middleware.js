import cors from 'cors';
import env from '../config/env.js';

/**
 * Baseline security headers middleware
 */
export function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

/**
 * Dynamic CORS configuration based on validated allowed origins
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g., Postman, curl, server-to-server) or matched origins
    if (!origin || env.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});

export default { securityHeadersMiddleware, corsMiddleware };
