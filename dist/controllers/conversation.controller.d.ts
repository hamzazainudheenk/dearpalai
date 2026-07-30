import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
export declare class ConversationController {
    /**
     * GET /api/patients/:id/conversations
     * Retrieves conversation history for a patient.
     */
    getConversations(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=conversation.controller.d.ts.map