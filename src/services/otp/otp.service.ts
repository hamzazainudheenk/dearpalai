/**
 * OTP storage, rate limiting, and verification.
 *
 * Delivery is delegated to an `OtpProvider` (see `otp-provider.ts`); this
 * file owns everything about the OTP's lifecycle that must be real and
 * secure regardless of whether delivery itself is mocked: hashed storage,
 * expiry, resend cooldown, and a capped number of verification attempts.
 *
 * The OTP value itself is never logged and never appears in any error
 * message — only its hash is ever persisted (`otp_verifications.otp_hash`).
 */

import { supabaseAdmin } from '@config/supabase';
import { config } from '@config/index';
import { AppError } from '@middleware/error.middleware';
import { generateNumericOtp } from '@utils/codes';
import { hashOtp, timingSafeEqualHex } from '@utils/crypto';
import { logger } from '@utils/logger';
import { OtpProvider } from './otp-provider';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const MAX_VERIFY_ATTEMPTS = 5;

export type OtpPurpose = 'caretaker_login' | 'patient_login';

export class OtpService {
  constructor(private readonly provider: OtpProvider) {}

  /**
   * Generates, stores (hashed), and "sends" an OTP for `mobile`. Enforces a
   * resend cooldown per mobile+purpose so a client can't trigger unlimited
   * sends. Returns `devOtp` only when running in explicit mock/dev mode —
   * never in production, and never logged either way.
   */
  async sendOtp(mobile: string, purpose: OtpPurpose): Promise<{ devOtp?: string }> {
    const { data: recent } = await supabaseAdmin
      .from('otp_verifications')
      .select('created_at')
      .eq('mobile_number', mobile)
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      const elapsedMs = Date.now() - new Date(recent.created_at).getTime();
      if (elapsedMs < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        throw new AppError(
          `Please wait ${waitSeconds}s before requesting another code.`,
          429,
          true,
          'OTP_RESEND_COOLDOWN',
        );
      }
    }

    const otp = generateNumericOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error } = await supabaseAdmin.from('otp_verifications').insert({
      mobile_number: mobile,
      purpose,
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

    if (error) {
      logger.error('Failed to store OTP record', { error: error.message, purpose });
      throw new AppError('Could not start verification. Please try again.', 500);
    }

    // Delivery — may throw OTP_PROVIDER_NOT_CONFIGURED (503); the OTP row
    // above still exists but simply expires unused, which is fine.
    await this.provider.send(mobile, otp);

    const devOtp =
      config.security.otpProvider === 'mock' && !config.server.isProduction ? otp : undefined;

    return { devOtp };
  }

  /**
   * Verifies `otp` against the most recent unverified, unexpired record for
   * `mobile`+`purpose`. Enforces a per-record attempt cap. Never reveals
   * *why* verification failed (expired vs. wrong vs. too many attempts) —
   * all failures return the same generic error.
   */
  async verifyOtp(mobile: string, otp: string, purpose: OtpPurpose): Promise<void> {
    const genericError = () =>
      new AppError('The code is invalid or has expired.', 400, true, 'INVALID_OTP');

    const { data: record, error } = await supabaseAdmin
      .from('otp_verifications')
      .select('id, otp_hash, expires_at, verified_at, attempt_count')
      .eq('mobile_number', mobile)
      .eq('purpose', purpose)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to load OTP record', { error: error.message, purpose });
      throw new AppError('Could not verify the code. Please try again.', 500);
    }

    if (!record) throw genericError();
    if (record.attempt_count >= MAX_VERIFY_ATTEMPTS) throw genericError();
    if (new Date(record.expires_at).getTime() < Date.now()) throw genericError();

    const submittedHash = hashOtp(otp);
    const matches = timingSafeEqualHex(submittedHash, record.otp_hash);

    if (!matches) {
      await supabaseAdmin
        .from('otp_verifications')
        .update({ attempt_count: record.attempt_count + 1 })
        .eq('id', record.id);
      throw genericError();
    }

    await supabaseAdmin
      .from('otp_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', record.id);
  }
}
