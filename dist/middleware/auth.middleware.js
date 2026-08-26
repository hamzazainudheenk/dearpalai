"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateDoctor = authenticateDoctor;
exports.requireAdmin = requireAdmin;
exports.authenticatePatient = authenticatePatient;
exports.authenticateCaretaker = authenticateCaretaker;
exports.authenticateChatIdentity = authenticateChatIdentity;
const supabase_1 = require("../config/supabase");
const logger_1 = require("../utils/logger");
const patient_auth_service_1 = require("../services/patient-auth.service");
async function authenticateDoctor(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            logger_1.logger.warn('Authentication failed for request', { error: error?.message });
            res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
            return;
        }
        // Retrieve doctor profile to get role
        let role = 'doctor';
        try {
            const { data: doctorProfile } = await supabase_1.supabaseAdmin
                .from('doctors')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            if (doctorProfile?.role === 'admin') {
                role = 'admin';
            }
            else if (user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin') {
                role = 'admin';
            }
        }
        catch (dbErr) {
            logger_1.logger.warn('Failed to fetch doctor role, defaulting to doctor', { error: dbErr.message });
        }
        req.doctor = {
            id: user.id,
            email: user.email || '',
            fullName: user.user_metadata?.full_name || '',
            role,
        };
        next();
    }
    catch (err) {
        logger_1.logger.error('Unexpected error in auth middleware', { error: err.message });
        res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
    }
}
/**
 * Authorization Middleware: Ensures only users with role = 'admin' can proceed.
 * Returns 403 Forbidden if user is not an admin.
 */
async function requireAdmin(req, res, next) {
    if (!req.doctor || req.doctor.role !== 'admin') {
        logger_1.logger.warn('Non-admin user attempted to access admin endpoint', {
            userId: req.doctor?.id,
            email: req.doctor?.email,
            role: req.doctor?.role,
        });
        res.status(403).json({
            status: 'error',
            message: 'Forbidden: Admin access required',
        });
        return;
    }
    next();
}
const patientAuthService = new patient_auth_service_1.PatientAuthService();
/**
 * Authenticates a Patient bearer token (a real Supabase Auth session
 * minted by `/api/patient/login/verify`) and loads their safe profile.
 * Patient auth never grants Doctor-only access — this middleware only
 * ever populates `req.patient`, never `req.doctor`.
 */
async function authenticatePatient(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error, } = await supabase_1.supabaseAdmin.auth.getUser(token);
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
    }
    catch (err) {
        logger_1.logger.error('Unexpected error in patient auth middleware', { error: err.message });
        res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
    }
}
/**
 * Authenticates a Caretaker bearer token (a real Supabase Auth session
 * minted by `/api/caretaker/otp/verify` — see `services/auth/caretaker-
 * session.ts`). Caretaker auth never grants Doctor or Patient access.
 */
async function authenticateCaretaker(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error, } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
            return;
        }
        const { data: caretaker } = await supabase_1.supabaseAdmin
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
    }
    catch (err) {
        logger_1.logger.error('Unexpected error in caretaker auth middleware', { error: err.message });
        res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
    }
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
async function authenticateChatIdentity(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error, } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
            return;
        }
        const { data: patient } = await supabase_1.supabaseAdmin
            .from('patients')
            .select('id, phone_number')
            .eq('auth_user_id', user.id)
            .maybeSingle();
        if (patient) {
            req.chatIdentity = { type: 'patient', patientId: patient.id, mobile: patient.phone_number };
            next();
            return;
        }
        const { data: caretaker } = await supabase_1.supabaseAdmin
            .from('caretakers')
            .select('id, mobile_number')
            .eq('id', user.id)
            .maybeSingle();
        if (caretaker) {
            const { data: link } = await supabase_1.supabaseAdmin
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
    }
    catch (err) {
        logger_1.logger.error('Unexpected error in chat auth middleware', { error: err.message });
        res.status(500).json({ status: 'error', message: 'Internal server error during authentication' });
    }
}
//# sourceMappingURL=auth.middleware.js.map