import { Request, Response, NextFunction } from 'express';
import { SafePatientProfile } from '../services/patient-auth.service';
export interface AuthenticatedRequest extends Request {
    doctor?: {
        id: string;
        email: string;
        fullName?: string;
        role: 'doctor' | 'admin';
    };
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
export declare function authenticateDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Authorization Middleware: Ensures only users with role = 'admin' can proceed.
 * Returns 403 Forbidden if user is not an admin.
 */
export declare function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Authenticates a Patient bearer token (a real Supabase Auth session
 * minted by `/api/patient/login/verify`) and loads their safe profile.
 * Patient auth never grants Doctor-only access — this middleware only
 * ever populates `req.patient`, never `req.doctor`.
 */
export declare function authenticatePatient(req: AuthenticatedPatientRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Authenticates a Caretaker bearer token (a real Supabase Auth session
 * minted by `/api/caretaker/otp/verify` — see `services/auth/caretaker-
 * session.ts`). Caretaker auth never grants Doctor or Patient access.
 */
export declare function authenticateCaretaker(req: AuthenticatedCaretakerRequest, res: Response, next: NextFunction): Promise<void>;
/** Phase 2 (Chat Bridge) identity — whichever of patient/caretaker the
 *  bearer token resolved to. Never both; the chat endpoint uses `type` to
 *  enforce that the request's `conversationScope` matches who is actually
 *  authenticated, rather than trusting the request body. */
export type ChatIdentity = {
    type: 'patient';
    patientId: string;
    mobile: string;
} | {
    type: 'caretaker';
    caretakerId: string;
    mobile: string;
    linkedPatientId: string | null;
};
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
export declare function authenticateChatIdentity(req: AuthenticatedChatRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map