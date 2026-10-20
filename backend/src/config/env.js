import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

/**
 * Validate and export application configuration
 */
function validateConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '5000', 10);
  const databaseUrl = process.env.DATABASE_URL;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const trustProxyValue = process.env.TRUST_PROXY?.trim();

  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`[Config] Invalid PORT specification: "${process.env.PORT}". Must be a valid TCP port (1-65535).`);
  }

  if (trustProxyValue?.toLowerCase() === 'true') {
    throw new Error('[Config] TRUST_PROXY must name trusted proxy IPs/CIDRs or a hop count; do not use "true".');
  }

  const trustProxy = !trustProxyValue || trustProxyValue.toLowerCase() === 'false'
    ? false
    : /^\d+$/.test(trustProxyValue)
      ? Number(trustProxyValue)
      : trustProxyValue.split(',').map((value) => value.trim()).filter(Boolean);

  // Pre-configured allowed origins for CORS
  const defaultAllowedOrigins = [
    clientUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];

  // Optional comma-separated origins from environment
  const extraOrigins = process.env.ADDITIONAL_CORS_ORIGINS
    ? process.env.ADDITIONAL_CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...extraOrigins]));

  return {
    port,
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isTest: nodeEnv === 'test',
    databaseUrl,
    clientUrl,
    trustProxy,
    allowedOrigins,
  };
}

export const env = validateConfig();
export default env;
