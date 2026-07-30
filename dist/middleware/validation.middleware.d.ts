/**
 * Validation Middleware
 *
 * Validates webhook query parameters (GET) and
 * request body structure (POST) before they reach controllers.
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Validates GET /webhook query parameters for Meta webhook verification.
 * Required params: hub.mode, hub.verify_token, hub.challenge
 */
export declare function validateWebhookQuery(req: Request, res: Response, next: NextFunction): void;
/**
 * Validates POST /webhook request body has the expected WhatsApp structure.
 */
export declare function validateWebhookBody(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=validation.middleware.d.ts.map