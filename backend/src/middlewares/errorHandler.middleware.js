import env from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Centralized Error Handling Middleware
 * Ensures safe, structured client-facing errors without leaking stack traces or credentials in production
 */
export function errorHandlerMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isDev = env.isDevelopment;

  logger.error(`API Error on ${req.method} ${req.originalUrl}:`, err);

  const responsePayload = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  if (err.code) {
    responsePayload.code = err.code;
  }

  if (isDev && err.stack) {
    responsePayload.stack = err.stack;
  }

  res.status(statusCode).json(responsePayload);
}

export default errorHandlerMiddleware;
