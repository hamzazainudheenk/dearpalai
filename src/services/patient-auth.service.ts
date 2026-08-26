/**
 * Patient account creation, login, and profile — the Phase 1 backend
 * foundation for DearPal Care's Patient role.
 *
 * Patient identity is a real Supabase Auth user (email-based), created
 * server-side at signup. Login uses Supabase's own built-in email OTP
 * (`signInWithOtp`/`verifyOtp`, type 'email') — this requires no SMS
 * provider and no invented auth mechanism; it's a first-class Supabase
 * Auth feature already available with this project's existing
 * configuration.
 */

import { supabaseAdmin } from '@config/supabase';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';
import { generatePublicDearPalId, generateCaretakerCode } from '@utils/codes';
import { hashCaretakerCode, encryptCaretakerCode, decryptCaretakerCode } from '@utils/crypto';
import { isValidEmail, isValidMobile, normalizeMobile } from '@utils/account-validators';

const CARETAKER_CODE_TTL_DAYS = 30;
const DEARPAL_ID_MAX_ATTEMPTS = 5;

/** Only ever exposed to clients — never the raw `patients` row, never the
 *  UUID `id`, never clinical/doctor-owned fields. */
export interface SafePatientProfile {
  dearPalId: string;
  fullName: string;
  mobile: string;
  email: string;
  clinic: string;
  status: string;
}

export interface CaretakerCodeStatusResponse {
  status: 'active' | 'linked' | 'expired';
  code: string | null;
  expiresAt: string | null;
  isLinked: boolean;
  linkedAt?: string | null;
}

export interface SignupInput {
  fullName: string;
  mobile: string;
  email: string;
  clinic?: string;
}

export class PatientAuthService {
  /**
   * Creates the patient's Supabase Auth identity + `patients` row, and
   * returns the caretaker code in plaintext exactly once. Nothing after
   * this call — not even this same patient's own profile endpoint — will
   * ever return that code again.
   */
  async signup(input: SignupInput): Promise<{ patient: SafePatientProfile; caretakerCode: string }> {
    const fullName = (input.fullName || '').trim();
    const mobile = normalizeMobile(input.mobile || '');
    const email = (input.email || '').trim().toLowerCase();
    const clinic = (input.clinic || '').trim();

    if (!fullName) {
      throw new AppError('Full name is required.', 400, true, 'VALIDATION_ERROR');
    }
    if (!isValidMobile(mobile)) {
      throw new AppError('Enter a valid 10-digit mobile number.', 400, true, 'VALIDATION_ERROR');
    }
    if (!isValidEmail(email)) {
      throw new AppError('Enter a valid email address.', 400, true, 'VALIDATION_ERROR');
    }

    const { data: existing } = await supabaseAdmin
      .from('patients')
      .select('id')
      .or(`phone_number.eq.${mobile},email.eq.${email}`)
      .maybeSingle();

    if (existing) {
      throw new AppError(
        'An account already exists for this mobile number or email.',
        409,
        true,
        'DUPLICATE_ACCOUNT',
      );
    }

    // 1. Create the Supabase Auth identity. No password — patient login is
    //    passwordless email OTP (see `login`/`verifyLogin` below).
    const { data: created, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      phone: mobile,
      phone_confirm: true,
      user_metadata: { full_name: fullName, role: 'patient' },
    });

    if (createUserError || !created?.user) {
      logger.error('Failed to create patient auth identity', {
        error: createUserError?.message,
      });
      if (createUserError?.message?.toLowerCase().includes('already')) {
        throw new AppError(
          'An account already exists for this mobile number or email.',
          409,
          true,
          'DUPLICATE_ACCOUNT',
        );
      }
      throw new AppError('Could not create the account. Please try again.', 500);
    }

    const authUserId = created.user.id;

    // 2. Generate a unique public DearPal ID (retry on the rare collision —
    //    this never touches the caretaker code path).
    let publicDearPalId = '';
    let patientRow: { id: string } | null = null;
    for (let attempt = 0; attempt < DEARPAL_ID_MAX_ATTEMPTS && !patientRow; attempt++) {
      publicDearPalId = generatePublicDearPalId();
      const { data, error } = await supabaseAdmin
        .from('patients')
        .insert({
          auth_user_id: authUserId,
          full_name: fullName,
          phone_number: mobile,
          email,
          clinic_name: clinic,
          public_dearpal_id: publicDearPalId,
          doctor_id: null, // pending clinic assignment — see Phase 1 report
          status: 'Active',
        })
        .select('id')
        .single();

      if (!error && data) {
        patientRow = data;
      } else if (error?.code !== '23505') {
        // Not a uniqueness violation — don't loop on a real error.
        logger.error('Failed to create patient profile', { error: error?.message });
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => undefined);
        throw new AppError('Could not create the account. Please try again.', 500);
      }
    }

    if (!patientRow) {
      logger.error('Exhausted DearPal ID generation attempts', { authUserId });
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => undefined);
      throw new AppError('Could not create the account. Please try again.', 500);
    }

    // 3. Generate the caretaker code — a *different* secret from the
    //    DearPal ID above — hash it for indexing and encrypt it with AES-256-GCM
    //    so the authenticated patient can securely retrieve it later.
    const caretakerCode = generateCaretakerCode();
    const codeHash = hashCaretakerCode(caretakerCode);
    const codeEncrypted = encryptCaretakerCode(caretakerCode);
    const expiresAt = new Date(Date.now() + CARETAKER_CODE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const { error: codeError } = await supabaseAdmin.from('caretaker_codes').insert({
      patient_id: patientRow.id,
      code_hash: codeHash,
      code_encrypted: codeEncrypted,
      expires_at: expiresAt.toISOString(),
    });

    if (codeError) {
      logger.error('Failed to store caretaker code', { error: codeError.message });
    }

    logger.info('Patient account created', { patientId: patientRow.id });

    return {
      patient: {
        dearPalId: publicDearPalId,
        fullName,
        mobile,
        email,
        clinic,
        status: 'Active',
      },
      caretakerCode,
    };
  }

  /** Starts passwordless login: Supabase sends a 6-digit email OTP using
   *  its own built-in email delivery. */
  async login(email: string): Promise<void> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      throw new AppError('Enter a valid email address.', 400, true, 'VALIDATION_ERROR');
    }

    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false },
    });

    if (error) {
      logger.warn('Patient login OTP request failed', {
        error: error.message || error.name || JSON.stringify(error),
      });

      if ((error as any).status === 429 || (error as any).code === 'over_email_send_rate_limit') {
        throw new AppError(
          'For security, please wait 60 seconds before requesting another verification code.',
          429,
          true,
          'RATE_LIMITED',
        );
      }
    }
  }

  /** Verifies the email OTP and returns a real Supabase session + the
   *  caller's safe profile. */
  async verifyLogin(
    email: string,
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string; patient: SafePatientProfile }> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const cleanToken = (token || '').trim();

    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      email: normalizedEmail,
      token: cleanToken,
      type: 'email',
    });

    if (error || !data.session || !data.user) {
      logger.warn('Patient OTP verification failed', {
        email: normalizedEmail,
        tokenLength: cleanToken.length,
        error: error?.message || 'No session returned',
      });
      throw new AppError('The code is invalid or has expired.', 400, true, 'INVALID_OTP');
    }

    const patient = await this.getProfileByAuthUserId(data.user.id);
    if (!patient) {
      throw new AppError('No patient account found for this login.', 404, true, 'NOT_FOUND');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      patient,
    };
  }

  /** Never selects `caretaker_codes`, `diagnosis`, `clinical_notes`,
   *  `risk_level`, or `doctor_id` — see the Phase 1 report for why each is
   *  excluded. */
  async getProfileByAuthUserId(authUserId: string): Promise<SafePatientProfile | null> {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('public_dearpal_id, full_name, phone_number, email, clinic_name, status')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      dearPalId: data.public_dearpal_id,
      fullName: data.full_name,
      mobile: data.phone_number,
      email: data.email || '',
      clinic: data.clinic_name || '',
      status: data.status,
    };
  }

  private async getPatientIdByDearPalId(dearPalId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('public_dearpal_id', dearPalId)
      .maybeSingle();
    return data?.id ?? null;
  }

  /**
   * Retrieves the active caretaker code or connection status for the authenticated patient.
   * Derives state:
   *  - 'linked': An active link exists in `patient_caretaker_links` or code was used.
   *  - 'active': Unused, unrevoked, unexpired code exists with valid ciphertext.
   *  - 'expired': Code expired, was revoked, or is a legacy row without ciphertext.
   */
  async getActiveCaretakerCode(dearPalId: string): Promise<CaretakerCodeStatusResponse> {
    const patientId = await this.getPatientIdByDearPalId(dearPalId);
    if (!patientId) {
      throw new AppError('Patient profile not found.', 404, true, 'NOT_FOUND');
    }

    // 1. Check if patient already has an active linked caretaker
    const { data: activeLink } = await supabaseAdmin
      .from('patient_caretaker_links')
      .select('id, linked_at, status')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .maybeSingle();

    if (activeLink) {
      return {
        status: 'linked',
        code: null,
        expiresAt: null,
        isLinked: true,
        linkedAt: activeLink.linked_at,
      };
    }

    // 2. Fetch the most recent caretaker code record for this patient
    const { data: codeRow, error } = await supabaseAdmin
      .from('caretaker_codes')
      .select('id, code_encrypted, expires_at, used_at, revoked_at, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to load caretaker code record', { error: error.message, patientId });
      throw new AppError('Could not retrieve caretaker code.', 500);
    }

    if (!codeRow) {
      return {
        status: 'expired',
        code: null,
        expiresAt: null,
        isLinked: false,
      };
    }

    // If code was already used
    if (codeRow.used_at) {
      return {
        status: 'linked',
        code: null,
        expiresAt: null,
        isLinked: true,
        linkedAt: codeRow.used_at,
      };
    }

    // If revoked
    if (codeRow.revoked_at) {
      return {
        status: 'expired',
        code: null,
        expiresAt: null,
        isLinked: false,
      };
    }

    // If expired
    if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
      return {
        status: 'expired',
        code: null,
        expiresAt: null,
        isLinked: false,
      };
    }

    // If legacy row with no encrypted value
    if (!codeRow.code_encrypted) {
      return {
        status: 'expired',
        code: null,
        expiresAt: null,
        isLinked: false,
      };
    }

    // Decrypt the code
    const decrypted = decryptCaretakerCode(codeRow.code_encrypted);
    if (!decrypted) {
      logger.warn('Caretaker code decryption failed (authentication tag mismatch or invalid key)', {
        patientId,
        codeId: codeRow.id,
      });
      return {
        status: 'expired',
        code: null,
        expiresAt: null,
        isLinked: false,
      };
    }

    return {
      status: 'active',
      code: decrypted,
      expiresAt: codeRow.expires_at,
      isLinked: false,
    };
  }

  /**
   * Generates a new active caretaker code for the patient, revoking any prior unused codes.
   */
  async refreshCaretakerCode(dearPalId: string): Promise<CaretakerCodeStatusResponse> {
    const patientId = await this.getPatientIdByDearPalId(dearPalId);
    if (!patientId) {
      throw new AppError('Patient profile not found.', 404, true, 'NOT_FOUND');
    }

    // 1. Revoke any prior unused/unrevoked codes for this patient
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from('caretaker_codes')
      .update({ revoked_at: nowIso })
      .eq('patient_id', patientId)
      .is('used_at', null)
      .is('revoked_at', null);

    // 2. Generate a new code
    const newCode = generateCaretakerCode();
    const codeHash = hashCaretakerCode(newCode);
    const codeEncrypted = encryptCaretakerCode(newCode);
    const expiresAt = new Date(Date.now() + CARETAKER_CODE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await supabaseAdmin.from('caretaker_codes').insert({
      patient_id: patientId,
      code_hash: codeHash,
      code_encrypted: codeEncrypted,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      logger.error('Failed to store refreshed caretaker code', { error: error.message, patientId });
      throw new AppError('Could not generate a new caretaker code. Please try again.', 500);
    }

    return {
      status: 'active',
      code: newCode,
      expiresAt: expiresAt.toISOString(),
      isLinked: false,
    };
  }
}
