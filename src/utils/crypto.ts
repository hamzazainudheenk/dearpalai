/**
 * Hashing helpers for account-linking secrets (caretaker codes, OTPs).
 *
 * Both are high-entropy, randomly generated, short-lived-or-revocable
 * values — not user-chosen passwords — so a keyed HMAC-SHA256 (not a slow
 * password hash like bcrypt/argon2) is the right tool: it's fast, and
 * brute-forcing the plaintext from a stolen hash still requires the pepper,
 * which is never stored in the database.
 *
 * Never log, return, or persist the plaintext code/OTP anywhere in this
 * module — only ever pass it in, get a hash out.
 */

import crypto from 'crypto';
import { config } from '@config/index';
import { logger } from '@utils/logger';

let warnedMissingCaretakerPepper = false;
let warnedMissingOtpPepper = false;

/** Dev-only fallback so a fresh checkout without a configured pepper still
 *  runs — never rely on this in production. */
const DEV_FALLBACK_PEPPER = 'dearpal-dev-pepper-CHANGE-ME';

function hmacHex(value: string, pepper: string): string {
  return crypto.createHmac('sha256', pepper).update(value).digest('hex');
}

/** Hashes a caretaker code for storage. Normalizes case/whitespace first so
 *  a pasted code with stray spacing still matches on lookup. */
export function hashCaretakerCode(code: string): string {
  if (!config.security.caretakerCodePepper && !warnedMissingCaretakerPepper) {
    warnedMissingCaretakerPepper = true;
    logger.warn(
      '[Security] CARETAKER_CODE_PEPPER is not set — using a dev-only fallback pepper. ' +
        'Set a real secret in production; see .env.example.',
    );
  }
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
  return hmacHex(normalized, config.security.caretakerCodePepper || DEV_FALLBACK_PEPPER);
}

/** Hashes an OTP for storage. */
export function hashOtp(otp: string): string {
  if (!config.security.otpPepper && !warnedMissingOtpPepper) {
    warnedMissingOtpPepper = true;
    logger.warn(
      '[Security] OTP_PEPPER is not set — using a dev-only fallback pepper. ' +
        'Set a real secret in production; see .env.example.',
    );
  }
  const normalized = otp.trim();
  return hmacHex(normalized, config.security.otpPepper || DEV_FALLBACK_PEPPER);
}

/** Constant-time comparison of two equal-shaped hex digests, to avoid
 *  leaking timing information on hash comparisons. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

let warnedMissingEncryptionKey = false;

/**
 * Derives a 32-byte encryption key for AES-256-GCM.
 * Prioritizes CARETAKER_CODE_ENCRYPTION_KEY, falls back to SHA-256(CARETAKER_CODE_PEPPER || DEV_FALLBACK_PEPPER).
 */
function getEncryptionKey(overrideKey?: string): Buffer {
  const rawKey =
    overrideKey ||
    config.security.caretakerCodeEncryptionKey ||
    config.security.caretakerCodePepper ||
    DEV_FALLBACK_PEPPER;

  if (
    !overrideKey &&
    !config.security.caretakerCodeEncryptionKey &&
    !config.security.caretakerCodePepper &&
    !warnedMissingEncryptionKey
  ) {
    warnedMissingEncryptionKey = true;
    logger.warn(
      '[Security] CARETAKER_CODE_ENCRYPTION_KEY is not set — using a dev-only fallback key. ' +
        'Set a real 32-byte secret in production; see .env.example.',
    );
  }

  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a caretaker code using authenticated AES-256-GCM.
 * Output format: `ivHex:authTagHex:encryptedHex`
 */
export function encryptCaretakerCode(code: string, overrideKey?: string): string {
  const key = getEncryptionKey(overrideKey);
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(code.trim(), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16-byte auth tag

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted caretaker code.
 * Returns the plaintext code, or null if payload is invalid/corrupted/tampered.
 */
export function decryptCaretakerCode(payload: string, overrideKey?: string): string | null {
  if (!payload || typeof payload !== 'string') return null;

  const parts = payload.split(':');
  if (parts.length !== 3) return null;

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) return null;

  try {
    const key = getEncryptionKey(overrideKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    if (iv.length !== 12 || authTag.length !== 16) return null;

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logger.warn('Failed to decrypt caretaker code (authentication tag mismatch or invalid key)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
