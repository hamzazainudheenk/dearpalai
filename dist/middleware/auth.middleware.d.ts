import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    doctor?: {
        id: string;
        email: string;
        fullName?: string;
    };
}
export declare function authenticateDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map