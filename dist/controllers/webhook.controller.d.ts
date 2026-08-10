/**
 * Webhook Controller
 *
 * Handles:
 * 1. Webhook verification
 * 2. Incoming WhatsApp messages
 * 3. WhatsApp status updates (sent, delivered, read, failed)
 */
import { Request, Response } from "express";
import { WhatsAppService } from "../services/whatsapp/whatsapp.service";
import { MessageProcessor } from "../services/processing/message.processor";
export declare class WebhookController {
    private readonly whatsAppService;
    private readonly messageProcessor;
    constructor(whatsAppService: WhatsAppService, messageProcessor: MessageProcessor);
    verifyWebhook: (req: Request, res: Response) => void;
    handleWebhook: (req: Request, res: Response) => void;
}
//# sourceMappingURL=webhook.controller.d.ts.map