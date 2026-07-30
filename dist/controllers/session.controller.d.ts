import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
export declare class SessionController {
    /**
     * POST /api/patients/:id/sessions
     * Adds a clinical session note for a patient.
     */
    createSession(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * GET /api/patients/:id/sessions
     * Gets list of sessions for a specific patient.
     */
    getSessions(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=session.controller.d.ts.map