import { isIP } from 'node:net';

export function normalizeClientIp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const address = value.trim().split(',')[0].trim();
  const normalized = address === '::1'
    ? '127.0.0.1'
    : address.toLowerCase().startsWith('::ffff:')
      ? address.slice(7)
      : address;

  return isIP(normalized) ? normalized : null;
}
