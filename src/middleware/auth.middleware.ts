import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '@config/supabase';
import { logger } from '@utils/logger';
import { PatientAuthService, SafePatientProfile } from '@services/patient-auth.service';

export interface AuthenticatedProfessional {
  id: string;
  email: string;
  fullName?: string;
  role: 'doctor' | 'psw' | 'admin';
  posting?: string;
  employeeId?: string;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  doctor?: AuthenticatedProfessional;
  professional?: AuthenticatedProfessional;
  chatIdentity?: ChatIdentity;
}

export interface AuthenticatedPatientRequest extends Request {
  /** The patient's safe profile — never includes the caretaker code or
   *  clinical fields, same shape `GET /api/patient/profile` returns. */
  patient?: SafePatientProfile;
}

export interface AuthenticatedCaretakerRequest extends Request {
  caretaker?: {
    id: string;
    mobile: string;
  };
}

export async function authenticateDoctor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn('Authentication failed for request', { error: error?.message });
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
      return;
    }

    // Retrieve admin or doctor/psw profile to get role and status
    let role: 'doctor' | 'psw' | 'admin' | null = null;
    let posting = '';
    let employeeId = '';
    let isActive = true;

    try {
      // 1. Check dedicated admins table first
      const { data: adminRecord } = await supabaseAdmin
        .from('admins')
        .select('id, full_name, is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (adminRecord) {
        role = 'admin';
        if (adminRecord.is_active === false) {
          isActive = false;
        }
      } else {
        // 2. Check doctors / professionals table
        const { data: doctorProfile } = await supabaseAdmin
          .from('doctors')
          .select('role, posting, employee_id, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (doctorProfile) {
          if (doctorProfile.role === 'admin' || doctorProfile.role === 'doctor' || doctorProfile.role === 'psw') {
            role = doctorProfile.role;
          }
          posting = doctorProfile.posting || '';
          employeeId = doctorProfile.employee_id || '';
          if (doctorProfile.is_active === false) {
            isActive = false;
          }
        }
      }

      if (!role) {
        if (user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin') {
          role = 'admin';
        } else if (user.user_metadata?.role === 'psw' || user.app_metadata?.role === 'psw') {
          role = 'psw';
          posting = user.user_metadata?.posting || '';
          employeeId = user.user_metadata?.employee_id || '';
        } else if (user.user_metadata?.role === 'doctor' || user.app_metadata?.role === 'doctor') {
          role = 'doctor';
          employeeId = user.user_metadata?.employee_id || '';
        }
      }

      if (user.user_metadata?.is_active === false || user.app_metadata?.is_active === false) {
        isActive = false;
      }
    } catch (dbErr) {
      logger.warn('Failed to fetch professional role', { error: (dbErr as Error).message });
    }

    // If role cannot be resolved, check metadata fallback
    let resolvedRole: 'doctor' | 'psw' | 'admin';
    if (!role) {
      const metaRole = user.user_metadata?.role || user.app_metadata?.role;
      if (metaRole === 'psw' || metaRole === 'admin' || metaRole === 'doctor') {
        resolvedRole = metaRole;
      } else {
        // Unverified user role: do not silently grant doctor access
        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Account does not have a verified professional role (Doctor or PSW)',
        });
        return;
      }
    } else {
      resolvedRole = role;
    }

    // Inactive Account Check (Admin users are exempt from active check)
    if (!isActive && resolvedRole !== 'admin') {
      logger.warn('Inactive professional attempted to access API', {
        userId: user.id,
        email: user.email,
        role: resolvedRole,
      });
      res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_INACTIVE',
        message: 'Your professional account is currently inactive. Please contact your administrator.',
      });
      return;
    }

    const professional: AuthenticatedProfessional = {
      id: user.id,
      email: user.email || '',
      fullName: user.user_metadata?.full_name || '',
      role: resolvedRole,
      posting,
      employeeId,
      isActive,
    };

    req.professional = professional;
    req.doctor = professional;

    next();
  } catch (err) {
    logger.error('Unexpected error in auth middleware', { error: (err as Error).message });
    res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
}

export const authenticateProfessional = authenticateDoctor;

/**
 * Authorization Middleware: Ensures only users with role = 'doctor' or 'admin' can proceed.
 */
export async function requireDoctor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.professional || (req.professional.role !== 'doctor' && req.professional.role !== 'admin')) {
    logger.warn('Non-doctor user attempted to access doctor endpoint', {
      userId: req.professional?.id,
      role: req.professional?.role,
    });
    res.status(403).json({
      status: 'error',
      message: 'Forbidden: Doctor access required',
    });
    return;
  }
  next();
}

/**
 * Authorization Middleware: Ensures only users with role = 'psw' or 'admin' can proceed.
 */
export async function requirePsw(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.professional || (req.professional.role !== 'psw' && req.professional.role !== 'admin')) {
    logger.warn('Non-PSW user attempted to access PSW endpoint', {
      userId: req.professional?.id,
      role: req.professional?.role,
    });
    res.status(403).json({
      status: 'error',
      message: 'Forbidden: PSW access required',
    });
    return;
  }
  next();
}

/**
 * Authorization Middleware: Ensures only users with role = 'admin' can proceed.
 * Returns 403 Forbidden if user is not an admin.
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.professional || req.professional.role !== 'admin') {
    logger.warn('Non-admin user attempted to access admin endpoint', {
      userId: req.professional?.id,
      email: req.professional?.email,
      role: req.professional?.role,
    });
    res.status(403).json({
      status: 'error',
      message: 'Forbidden: Admin access required',
    });
    return;
  }
  next();
}

const patientAuthService = new PatientAuthService();

/**
 * Authenticates a Patient bearer token (a real Supabase Auth session
 * minted by `/api/patient/login/verify`) and loads their safe profile.
 * Patient auth never grants Doctor-only access — this middleware only
 * ever populates `req.patient`, never `req.doctor`.
 */
export async function authenticatePatient(
  req: AuthenticatedPatientRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
      return;
    }

    const patient = await patientAuthService.getProfileByAuthUserId(user.id);
    if (!patient) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: No patient account found' });
      return;
    }

    req.patient = patient;
    next();
  } catch (err) {
    logger.error('Unexpected error in patient auth middleware', { error: (err as Error).message });
    res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
}

/**
 * Authenticates a Caretaker bearer token (a real Supabase Auth session
 * minted by `/api/caretaker/otp/verify` — see `services/auth/caretaker-
 * session.ts`). Caretaker auth never grants Doctor or Patient access.
 */
export async function authenticateCaretaker(
  req: AuthenticatedCaretakerRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
      return;
    }

    const { data: caretaker } = await supabaseAdmin
      .from('caretakers')
      .select('id, mobile_number')
      .eq('id', user.id)
      .maybeSingle();

    if (!caretaker) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: No caretaker account found' });
      return;
    }

    req.caretaker = { id: caretaker.id, mobile: caretaker.mobile_number };
    next();
  } catch (err) {
    logger.error('Unexpected error in caretaker auth middleware', { error: (err as Error).message });
    res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
}

/** Phase 2 (Chat Bridge) identity — whichever of patient/caretaker the
 *  bearer token resolved to. Never both; the chat endpoint uses `type` to
 *  enforce that the request's `conversationScope` matches who is actually
 *  authenticated, rather than trusting the request body. */
export type ChatIdentity =
  | { type: 'patient'; patientId: string; mobile: string }
  | { type: 'caretaker'; caretakerId: string; mobile: string; linkedPatientId: string | null };

export interface AuthenticatedChatRequest extends Request {
  chatIdentity?: ChatIdentity;
}

/**
 * Authenticates EITHER a Patient or a Caretaker bearer token for the chat
 * endpoints (`/api/chat/*`), and resolves the raw `patients.id` /
 * `caretakers.id` needed to scope conversation storage — `req.patient`
 * (Phase 1) deliberately never exposes the raw id, so this middleware does
 * its own minimal lookup rather than reusing `authenticatePatient`/
 * `authenticateCaretaker` directly (each of those terminates the request
 * on its own on failure, which doesn't compose for "try patient, then
 * caretaker").  For a caretaker, also resolves their most recently linked
 * ACTIVE patient — never used to load that patient's own conversation, only
 * to tag the caretaker's own conversation row for future reference (see
 * `chat.service.ts`).
 */
export async function authenticateChatIdentity(
  req: AuthenticatedChatRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
      return;
    }

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, phone_number')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (patient) {
      req.chatIdentity = { type: 'patient', patientId: patient.id, mobile: patient.phone_number };
      next();
      return;
    }

    const { data: caretaker } = await supabaseAdmin
      .from('caretakers')
      .select('id, mobile_number')
      .eq('id', user.id)
      .maybeSingle();

    if (caretaker) {
      const { data: link } = await supabaseAdmin
        .from('patient_caretaker_links')
        .select('patient_id')
        .eq('caretaker_id', caretaker.id)
        .eq('status', 'active')
        .order('linked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      req.chatIdentity = {
        type: 'caretaker',
        caretakerId: caretaker.id,
        mobile: caretaker.mobile_number,
        linkedPatientId: link?.patient_id ?? null,
      };
      next();
      return;
    }

    res.status(401).json({ status: 'error', message: 'Unauthorized: No account found for this token' });
  } catch (err) {
    logger.error('Unexpected error in chat auth middleware', { error: (err as Error).message });
    res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
}

/**
 * Authenticates ANY communication user (Doctor, PSW, Admin, Patient, or Caretaker)
 * for the unified communication endpoints (/api/communications/*).
 */
export async function authenticateCommunicationUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
      return;
    }

    // 1. Check Admins table
    const { data: adminRecord } = await supabaseAdmin
      .from('admins')
      .select('id, full_name, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (adminRecord) {
      if (adminRecord.is_active === false) {
        res.status(403).json({
          status: 'error',
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is inactive. Please contact clinic administration.',
        });
        return;
      }
      req.doctor = {
        id: user.id,
        email: user.email || '',
        role: 'admin',
        fullName: adminRecord.full_name,
        posting: '',
        employeeId: '',
        isActive: true,
      };
      next();
      return;
    }

    // 2. Check Doctors / Professionals table
    const { data: doctorProfile } = await supabaseAdmin
      .from('doctors')
      .select('role, posting, employee_id, is_active, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (doctorProfile) {
      if (doctorProfile.is_active === false) {
        res.status(403).json({
          status: 'error',
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is inactive. Please contact clinic administration.',
        });
        return;
      }

      const role = doctorProfile.role === 'psw' ? 'psw' : doctorProfile.role === 'admin' ? 'admin' : 'doctor';
      req.doctor = {
        id: user.id,
        email: user.email || '',
        role,
        fullName: doctorProfile.full_name || '',
        posting: doctorProfile.posting || '',
        employeeId: doctorProfile.employee_id || '',
        isActive: true,
      };
      next();
      return;
    }

    // 3. Check Patient table
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, phone_number, full_name')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (patient) {
      req.chatIdentity = {
        type: 'patient',
        patientId: patient.id,
        mobile: patient.phone_number,
      };
      next();
      return;
    }

    // 4. Check Caretaker table
    const { data: caretaker } = await supabaseAdmin
      .from('caretakers')
      .select('id, mobile_number')
      .eq('id', user.id)
      .maybeSingle();

    if (caretaker) {
      const { data: link } = await supabaseAdmin
        .from('patient_caretaker_links')
        .select('patient_id')
        .eq('caretaker_id', caretaker.id)
        .eq('status', 'active')
        .order('linked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      req.chatIdentity = {
        type: 'caretaker',
        caretakerId: caretaker.id,
        mobile: caretaker.mobile_number,
        linkedPatientId: link?.patient_id ?? null,
      };
      next();
      return;
    }

    res.status(401).json({ status: 'error', message: 'Unauthorized: No verified user account found for this token' });
  } catch (err) {
    logger.error('Unexpected error in communication auth middleware', { error: (err as Error).message });
    res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
  }
}
