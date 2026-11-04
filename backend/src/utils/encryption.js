import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const AUTH_TAG_LENGTH = 16; // Standard 128-bit authentication tag

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || 'azzuniqe_crm_erp_hrms_master_secret_key_2026';
  // Derive deterministic 32-byte key safely
  return crypto.scryptSync(secret, 'crm_erp_salt_hrms_vault', 32);
}

/**
 * Encrypt sensitive plaintext string using AES-256-GCM
 * Output format: base64(iv:authTag:ciphertext)
 */
export function encryptSensitive(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  return Buffer.from(combined, 'utf8').toString('base64');
}

/**
 * Decrypt AES-256-GCM encrypted payload
 */
export function decryptSensitive(encryptedBase64) {
  if (!encryptedBase64) return null;
  try {
    const combined = Buffer.from(encryptedBase64, 'base64').toString('utf8');
    const parts = combined.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null; // Return null on decryption error to prevent crashing
  }
}

/**
 * Mask PAN: e.g. ABCDE1234F -> ABCDE****F
 */
export function maskPan(pan) {
  if (!pan || typeof pan !== 'string') return null;
  const clean = pan.trim().toUpperCase();
  if (clean.length < 10) return clean;
  return `${clean.slice(0, 5)}****${clean.slice(9)}`;
}

/**
 * Mask Aadhaar: e.g. 123456789012 -> ********9012
 */
export function maskAadhaar(aadhaar) {
  if (!aadhaar || typeof aadhaar !== 'string') return null;
  const clean = aadhaar.replace(/[\s-]/g, '');
  if (clean.length < 4) return clean;
  return `${'*'.repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

/**
 * Mask Bank Account: e.g. 123456789012 -> ********9012
 */
export function maskBankAccount(accountNo) {
  if (!accountNo || typeof accountNo !== 'string') return null;
  const clean = accountNo.trim();
  if (clean.length < 4) return clean;
  return `${'*'.repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

/**
 * Cryptographic random string generator for tokens and download identifiers
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash token using SHA-256 for secure storage & comparison
 */
export function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export default {
  encryptSensitive,
  decryptSensitive,
  maskPan,
  maskAadhaar,
  maskBankAccount,
  generateSecureToken,
  hashToken,
};

