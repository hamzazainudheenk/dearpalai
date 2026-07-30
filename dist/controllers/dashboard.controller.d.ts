import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
export declare class DashboardController {
    /**
     * GET /api/dashboard/stats
     * Aggregates stats, alerts, and activity for the doctor's dashboard.
     */
    getStats(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=dashboard.controller.d.ts.map