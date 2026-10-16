/**
 * Safe, structured server-side logger
 * Formats timestamps and log levels without leaking sensitive credentials or stack traces in production
 */
import env from '../config/env.js';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevelName = (process.env.LOG_LEVEL || (env.isDevelopment ? 'debug' : 'info')).toLowerCase();
const currentLevel = LOG_LEVELS[currentLevelName] !== undefined ? LOG_LEVELS[currentLevelName] : LOG_LEVELS.info;

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (meta && Object.keys(meta).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(meta)}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  error(message, errorOrMeta) {
    if (currentLevel >= LOG_LEVELS.error) {
      if (errorOrMeta instanceof Error) {
        console.error(formatMessage('error', message), errorOrMeta.message);
        if (env.isDevelopment && errorOrMeta.stack) {
          console.error(errorOrMeta.stack);
        }
      } else {
        console.error(formatMessage('error', message, errorOrMeta));
      }
    }
  },

  warn(message, meta) {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  info(message, meta) {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  },

  debug(message, meta) {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  },
};

export default logger;
