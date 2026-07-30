/**
 * Webhook Controller
 *
 * Thin controller — contains no business logic.
 * Delegates webhook verification to WhatsAppService and
 * message processing to MessageProcessor.
 *
 * The POST handler responds 200 immediately (WhatsApp requirement)
 * and processes the message asynchronously via fire-and-forget.
 */
import { Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp/whatsapp.service';
import { MessageProcessor } from '../services/processing/message.processor';
export declare class WebhookController {
    private readonly whatsAppService;
    private readonly messageProcessor;
    constructor(whatsAppService: WhatsAppService, messageProcessor: MessageProcessor);
    /**
     * GET /webhook — Meta webhook verification.
     *
     * Validates the verify token and returns the challenge
     * to complete the webhook subscription handshake.
     */
    verifyWebhook: (req: Request, res: Response) => void;
    /**
     * POST /webhook — Receive incoming WhatsApp messages.
     *
     * Responds 200 immediately to satisfy WhatsApp's timeout requirements,
     * then processes the message asynchronously. This fire-and-forget pattern
     * means processing errors don't affect the webhook response, and the
     * architecture is ready for queue/worker migration in Phase 2.
     */
    handleWebhook: (req: Request, res: Response) => void;
}
//# sourceMappingURL=webhook.controller.d.ts.map