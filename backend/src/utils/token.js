import crypto from 'crypto';
import env from '../config/env.js';

// Secret key for signing tokens
const JWT_SECRET = process.env.JWT_SECRET || 'azzuniqe_enterprise_jwt_secret_2026_crm_erp_platform';

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64URL decoding helper
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Sign a token with HMAC-SHA256
 */
export function signToken(payload, expiresInSeconds = 86400) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

/**
 * Verify and decode a token
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    // Tokens without an expiry are not valid sessions.
    if (!Number.isFinite(payload.exp) || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract token from request (Bearer header or cookie)
 */
export function extractToken(req) {
  // 1. Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 2. Check Cookie header
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, pair) => {
      const [key, val] = pair.trim().split('=');
      if (key && val) acc[key] = decodeURIComponent(val);
      return acc;
    }, {});

    if (cookies['azzuniqe_session']) return cookies['azzuniqe_session'];
    if (cookies['azzuniqe_super_session']) return cookies['azzuniqe_super_session'];
    if (cookies['auth_token']) return cookies['auth_token'];
  }

  return null;
}

/**
 * Set HTTP-only session cookie
 */
export function setAuthCookie(res, token, name = 'azzuniqe_session', maxAgeSeconds = 86400) {
  const isProd = env.isProduction;

  // Manual cookie header to avoid third-party cookie-parser dependency
  const cookieString = [
    `${name}=${encodeURIComponent(token)}`,
    Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0 ? `Max-Age=${maxAgeSeconds}` : '',
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    isProd ? `Secure` : '',
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookieString);
}

/**
 * Clear session cookie
 */
export function clearAuthCookie(res, name = 'azzuniqe_session') {
  const clearedCookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
  const existingCookies = res.getHeader('Set-Cookie');
  const cookies = existingCookies
    ? Array.isArray(existingCookies)
      ? existingCookies
      : [existingCookies]
    : [];
  res.setHeader('Set-Cookie', [...cookies, clearedCookie]);
}

export default {
  signToken,
  verifyToken,
  extractToken,
  setAuthCookie,
  clearAuthCookie,
};
