/**
 * Public identifier and secret-code generation.
 *
 * Two very different things live in this file:
 *  - `generatePublicDearPalId` — a non-secret, safe-to-display identifier.
 *  - `generateCaretakerCode` — a secret, high-entropy linking credential.
 * Never confuse the two, and never derive one from the other or from the
 * database UUID (see `services/patient-auth.service.ts` for why the raw
 * `patients.id` UUID is never exposed to clients).
 */

import crypto from 'crypto';

/** Excludes visually ambiguous characters (0/O, 1/I/L) so a hand-copied or
 *  read-aloud code/ID is never misheard or mistyped. */
const SAFE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomFromAlphabet(alphabet: string, length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * A short, non-sequential, safe-to-display public identifier — e.g. "DP-7K4M".
 * Not a secret: it identifies the patient, the way a name badge does. Never
 * accept this as a caretaker-linking credential (see `generateCaretakerCode`).
 * Callers are responsible for retrying on the rare uniqueness collision —
 * this function only generates, it doesn't check the database.
 */
export function generatePublicDearPalId(): string {
  return `DP-${randomFromAlphabet(SAFE_ALPHABET, 4)}`;
}

/**
 * A secret, high-entropy caretaker-linking code — e.g. "CG-7K4MQ92X".
 * 8 characters from a 32-symbol alphabet ≈ 40 bits of entropy, well beyond
 * what's brute-forceable through the rate-limited link endpoint. Only ever
 * return this once, to the patient who just created the account; store
 * only its hash (see `utils/crypto.ts`).
 */
export function generateCaretakerCode(): string {
  return `CG-${randomFromAlphabet(SAFE_ALPHABET, 4)}${randomFromAlphabet(SAFE_ALPHABET, 4)}`;
}

/** A 6-digit numeric OTP. Zero-padded, so always exactly 6 characters. */
export function generateNumericOtp(): string {
  // 0-999999 inclusive; reject-and-retry avoids modulo bias.
  const max = 1_000_000;
  const limit = Math.floor(0xffffffff / max) * max;
  let value: number;
  do {
    value = crypto.randomBytes(4).readUInt32BE(0);
  } while (value >= limit);
  return (value % max).toString().padStart(6, '0');
}
