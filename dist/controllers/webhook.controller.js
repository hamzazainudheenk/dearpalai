"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
class WebhookController {
    constructor(whatsAppService, messageProcessor) {
        this.whatsAppService = whatsAppService;
        this.messageProcessor = messageProcessor;
        /**
         * GET /webhook — Meta webhook verification.
         *
         * Validates the verify token and returns the challenge
         * to complete the webhook subscription handshake.
         */
        this.verifyWebhook = (req, res) => {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];
            logger_1.logger.info('Webhook verification attempt', { mode });
            const result = this.whatsAppService.verifyWebhook(mode, token, challenge);
            if (result) {
                res.status(200).send(result);
            }
            else {
                res.status(403).json({
                    status: 'error',
                    message: 'Webhook verification failed',
                });
            }
        };
        /**
         * POST /webhook — Receive incoming WhatsApp messages.
         *
         * Responds 200 immediately to satisfy WhatsApp's timeout requirements,
         * then processes the message asynchronously. This fire-and-forget pattern
         * means processing errors don't affect the webhook response, and the
         * architecture is ready for queue/worker migration in Phase 2.
         */
        this.handleWebhook = (req, res) => {
            // Respond immediately — WhatsApp requires a fast response
            res.status(200).json({ status: 'received' });
            // Parse the incoming message
            const parsed = (0, helpers_1.parseIncomingMessage)(req.body);
            if (!parsed) {
                logger_1.logger.debug('Webhook received non-message event (status update, etc.)', {
                    object: req.body?.object,
                    hasMessages: !!req.body?.entry?.[0]?.changes?.[0]?.value?.messages,
                });
                return;
            }
            logger_1.logger.info('Incoming message received', {
                messageId: parsed.messageId,
                phoneNumber: parsed.phoneNumber,
                messageType: parsed.messageType,
                senderName: parsed.senderName,
            });
            // Fire-and-forget: process asynchronously
            // Errors are caught and logged internally by MessageProcessor
            this.messageProcessor.processMessage(parsed).catch((error) => {
                logger_1.logger.error('Unhandled error in message processing', {
                    messageId: parsed.messageId,
                    error: error.message,
                    stack: error.stack,
                });
            });
        };
    }
}
exports.WebhookController = WebhookController;
//# sourceMappingURL=webhook.controller.js.map