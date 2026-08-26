/**
 * Caretaker OTP login and patient linking — the Phase 1 backend foundation
 * for DearPal Care's Caretaker role.
 *
 * Caretaker identity is a real Supabase Auth user, created on first
 * successful OTP verification. See `services/auth/caretaker-session.ts`
 * for why session issuance uses a synthetic-email workaround rather than
 * Supabase's native phone sign-in (no SMS provider configured).
 *
 * IMPORTANT (verified against the live dev Supabase project): creating a
 * user with `phone` alone fails with an opaque `AuthRetryableFetchError`
 * 500 — this project's Auth configuration rejects phone-only identities.
 * `phone` + `email` together succeeds. So the caretaker's Auth identity is
 * always created with BOTH a phone (the real mobile number, for our own
 * `caretakers` lookup) and a synthetic internal email (never phone-derived,
 * never shown to anyone) in the same `createUser` call — never phone alone.
 */

import crypto from 'crypto';
import { supabaseAdmin } from '@config/supabase';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';
import { hashCaretakerCode } from '@utils/crypto';
import { normalizeMobile, isValidMobile } from '@utils/account-validators';
import { OtpService } from './otp/otp.service';
import { mintCaretakerSession } from './auth/caretaker-session';

/** Same convention as `caretaker-session.ts`'s magic-link exchange — never
 *  derived from the phone number, never shown to the caretaker, never
 *  returned from any API response, never logged. A fresh random UUID
 *  (rather than the eventual Auth user id, which doesn't exist until
 *  *after* this call) keeps it collision-safe with no chicken-and-egg
 *  ordering problem. */
function generateSyntheticInternalEmail(): string {
  return `caretaker+${crypto.randomUUID()}@caretaker.internal.dearpal`;
}

export interface SafeLinkedPatient {
  dearPalId: string;
  displayName: string;
}

export class CaretakerAuthService {
  constructor(private readonly otpService: OtpService) {}

  async sendOtp(mobile: string): Promise<{ devOtp?: string }> {
    const normalized = normalizeMobile(mobile);
    if (!isValidMobile(normalized)) {
      throw new AppError('Enter a valid 10-digit mobile number.', 400, true, 'VALIDATION_ERROR');
    }
    return this.otpService.sendOtp(normalized, 'caretaker_login');
  }

  /**
   * Verifies the OTP, then finds-or-creates the caretaker's Supabase Auth
   * identity for that mobile number and mints a real session.
   */
  async verifyOtpAndAuthenticate(
    mobile: string,
    otp: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const normalized = normalizeMobile(mobile);
    if (!isValidMobile(normalized)) {
      throw new AppError('Enter a valid 10-digit mobile number.', 400, true, 'VALIDATION_ERROR');
    }

    await this.otpService.verifyOtp(normalized, otp, 'caretaker_login');

    const { data: existingCaretaker } = await supabaseAdmin
      .from('caretakers')
      .select('id')
      .eq('mobile_number', normalized)
      .maybeSingle();

    let caretakerId = existingCaretaker?.id as string | undefined;

    if (!caretakerId) {
      // Never call createUser with `phone` alone — see the file-level doc
      // comment. The synthetic email is set here, at creation, and is
      // never logged (only its *presence* is confirmed below, not its
      // value).
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: normalized,
        phone_confirm: true,
        email: generateSyntheticInternalEmail(),
        email_confirm: true,
        user_metadata: { role: 'caretaker' },
      });

      if (createError || !created?.user) {
        logger.error('Failed to create caretaker auth identity', {
          error: createError?.message,
        });
        throw new AppError('Could not sign in. Please try again.', 500);
      }

      caretakerId = created.user.id;

      const { error: insertError } = await supabaseAdmin
        .from('caretakers')
        .insert({ id: caretakerId, mobile_number: normalized });

      if (insertError) {
        logger.error('Failed to create caretaker profile row', { error: insertError.message });
        throw new AppError('Could not sign in. Please try again.', 500);
      }
    }

    const session = await mintCaretakerSession(caretakerId);
    return { accessToken: session.accessToken, refreshToken: session.refreshToken };
  }

  /**
   * Validates a caretaker code and, if valid, links `caretakerId` to the
   * patient it belongs to. The error is always the same generic message
   * regardless of *why* the code didn't work (not found / expired /
   * revoked / already used) — see the Phase 1 report's security section.
   */
  async linkWithCode(caretakerId: string, rawCode: string): Promise<{ patient: SafeLinkedPatient }> {
    const invalidCodeError = () =>
      new AppError(
        'The code is invalid or no longer available.',
        400,
        true,
        'INVALID_CARETAKER_CODE',
      );

    const code = (rawCode || '').trim();
    if (!code) {
      logger.warn('Caretaker link failed: empty code');
      throw invalidCodeError();
    }

    const codeHash = hashCaretakerCode(code);
    logger.info('Attempting caretaker link', { rawCode, code, codeHash, caretakerId });

    const { data: codeRow, error: codeLookupError } = await supabaseAdmin
      .from('caretaker_codes')
      .select('id, patient_id, expires_at, used_at, revoked_at')
      .eq('code_hash', codeHash)
      .maybeSingle();

    if (codeLookupError) {
      logger.error('Failed to look up caretaker code', { error: codeLookupError.message });
      throw new AppError('Could not link the account. Please try again.', 500);
    }

    if (!codeRow) {
      logger.warn('Caretaker link failed: code not found for hash', { codeHash });
      throw invalidCodeError();
    }
    if (codeRow.revoked_at) {
      logger.warn('Caretaker link failed: code revoked', { codeId: codeRow.id });
      throw invalidCodeError();
    }
    if (codeRow.used_at) {
      logger.warn('Caretaker link failed: code already used', { codeId: codeRow.id });
      throw invalidCodeError();
    }
    if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
      logger.warn('Caretaker link failed: code expired', { codeId: codeRow.id, expiresAt: codeRow.expires_at });
      throw invalidCodeError();
    }

    // Already linked to this same patient? Treat as success rather than an
    // error — a duplicate tap shouldn't punish the caretaker.
    const { data: existingLink } = await supabaseAdmin
      .from('patient_caretaker_links')
      .select('id')
      .eq('patient_id', codeRow.patient_id)
      .eq('caretaker_id', caretakerId)
      .eq('status', 'active')
      .maybeSingle();

    if (!existingLink) {
      const { error: linkError } = await supabaseAdmin.from('patient_caretaker_links').insert({
        patient_id: codeRow.patient_id,
        caretaker_id: caretakerId,
        status: 'active',
        linked_at: new Date().toISOString(),
      });

      if (linkError) {
        logger.error('Failed to create patient-caretaker link', { error: linkError.message });
        throw new AppError('Could not link the account. Please try again.', 500);
      }

      // Single-use by design (see Phase 1 report for the trade-off) — mark
      // used only on the first successful link, not on repeat taps above.
      await supabaseAdmin
        .from('caretaker_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', codeRow.id);
    }

    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('public_dearpal_id, full_name')
      .eq('id', codeRow.patient_id)
      .single();

    if (patientError || !patient) {
      logger.error('Failed to load linked patient summary', { error: patientError?.message });
      throw new AppError('Could not link the account. Please try again.', 500);
    }

    return {
      patient: {
        dearPalId: patient.public_dearpal_id,
        displayName: patient.full_name,
      },
    };
  }

  /**
   * GET /api/caretaker/me support — lets Flutter tell, right after OTP
   * login, whether this caretaker already has an active link (returning
   * caretaker → straight into the app) or needs the caretaker-code step
   * (first-time). Added alongside the Phase 2 Flutter auth wiring since
   * without it a returning caretaker has no way to skip re-linking —
   * `linkWithCode` alone can't answer "am I already linked?" without a code
   * in hand. Never reveals anything about a patient the caller isn't
   * already linked to.
   */
  async getActiveLink(caretakerId: string): Promise<{ patient: SafeLinkedPatient | null }> {
    const { data: link } = await supabaseAdmin
      .from('patient_caretaker_links')
      .select('patient_id')
      .eq('caretaker_id', caretakerId)
      .eq('status', 'active')
      .order('linked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!link) return { patient: null };

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('public_dearpal_id, full_name')
      .eq('id', link.patient_id)
      .maybeSingle();

    if (!patient) return { patient: null };

    return {
      patient: { dearPalId: patient.public_dearpal_id, displayName: patient.full_name },
    };
  }
}
