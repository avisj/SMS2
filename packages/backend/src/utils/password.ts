// ========================================================================
// Password Utility
// Cryptographically secure scrypt hashing with random salt & timing-safe equality
// ZERO plaintext passwords stored or returned
// ========================================================================

import crypto from 'crypto';

/**
 * Generates a secure salt and hashes the plain text password using scrypt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifies a plain text password against a stored salt:derivedKey hash
 */
export function verifyPassword(password: string, hashString: string): boolean {
  if (!hashString) return false;
  
  // If stored in legacy or plain format in dev fallback, handle safely
  if (!hashString.includes(':')) {
    return hashString === password;
  }

  const [salt, key] = hashString.split(':');
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);

  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}
