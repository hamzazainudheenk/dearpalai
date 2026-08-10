import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    doctor?: {
        id: string;
        email: string;
        fullName?: string;
        role: 'doctor' | 'admin';
    };
}
export declare function authenticateDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Authorization Middleware: Ensures only users with role = 'admin' can proceed.
 * Returns 403 Forbidden if user is not an admin.
 */
export declare function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map