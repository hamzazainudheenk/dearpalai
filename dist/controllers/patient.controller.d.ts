import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
export declare class PatientController {
    /**
     * POST /api/patients
     * Creates a new patient record in Supabase and automatically sends a WhatsApp welcome message.
     */
    createPatient(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * GET /api/patients
     * Lists patients for the logged-in doctor with search and pagination.
     */
    getPatients(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * GET /api/patients/:id
     * Retrieves single patient profile.
     */
    getPatientById(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=patient.controller.d.ts.map