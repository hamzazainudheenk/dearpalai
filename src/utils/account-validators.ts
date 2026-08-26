/**
 * Small, pure validation/normalization helpers for the Patient and
 * Caretaker account endpoints — mirrors the shape of the equivalent
 * Flutter-side helpers (`mobile/lib/utils/validators.dart`) without any
 * shared code between the two (different languages, different processes).
 */

const EMAIL_PATTERN = /^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$/;

/** Indian 10-digit mobile numbers starting 6-9. */
const MOBILE_PATTERN = /^[6-9]\d{9}$/;

/** Strips everything but digits, so "+91 98765 43210" and "9876543210"
 *  normalize to the same stored value. */
export function normalizeMobile(raw: string): string {
  return (raw || '').replace(/[^0-9]/g, '').replace(/^91(?=\d{10}$)/, '');
}

export function isValidMobile(mobile: string): boolean {
  return MOBILE_PATTERN.test(mobile);
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test((email || '').trim());
}
