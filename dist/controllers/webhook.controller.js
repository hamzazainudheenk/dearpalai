"use strict";
/**
 * Webhook Controller
 *
 * Handles:
 * 1. Webhook verification
 * 2. Incoming WhatsApp messages
 * 3. WhatsApp status updates (sent, delivered, read, failed)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
class WebhookController {
    constructor(whatsAppService, messageProcessor) {
        this.whatsAppService = whatsAppService;
        this.messageProcessor = messageProcessor;
        this.verifyWebhook = (req, res) => {
            const mode = req.query["hub.mode"];
            const token = req.query["hub.verify_token"];
            const challenge = req.query["hub.challenge"];
            logger_1.logger.info("Webhook verification attempt", { mode });
            const result = this.whatsAppService.verifyWebhook(mode, token, challenge);
            if (result) {
                res.status(200).send(result);
            }
            else {
                res.status(403).json({
                    status: "error",
                    message: "Webhook verification failed",
                });
            }
        };
        this.handleWebhook = (req, res) => {
            // Always acknowledge immediately
            res.status(200).json({
                status: "received",
            });
            const value = req.body?.entry?.[0]?.changes?.[0]?.value;
            /**
             * ---------------------------------------------------
             * STATUS UPDATES
             * ---------------------------------------------------
             */
            if (value?.statuses?.length) {
                for (const status of value.statuses) {
                    logger_1.logger.info("WhatsApp Status Update", {
                        messageId: status.id,
                        recipient: status.recipient_id,
                        status: status.status,
                        timestamp: status.timestamp,
                        conversation: status.conversation,
                        pricing: status.pricing,
                        errors: status.errors ?? null,
                    });
                    if (status.errors?.length) {
                        logger_1.logger.error("WhatsApp Message Failed", {
                            messageId: status.id,
                            errors: status.errors,
                        });
                    }
                }
                return;
            }
            /**
             * ---------------------------------------------------
             * INCOMING MESSAGE
             * ---------------------------------------------------
             */
            const parsed = (0, helpers_1.parseIncomingMessage)(req.body);
            if (!parsed) {
                logger_1.logger.debug("Webhook event ignored", {
                    object: req.body?.object,
                });
                return;
            }
            logger_1.logger.info("Incoming WhatsApp Message", {
                messageId: parsed.messageId,
                phoneNumber: parsed.phoneNumber,
                senderName: parsed.senderName,
                messageType: parsed.messageType,
            });
            this.messageProcessor.processMessage(parsed).catch((error) => {
                logger_1.logger.error("Unhandled message processing error", {
                    messageId: parsed.messageId,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
            });
        };
    }
}
exports.WebhookController = WebhookController;
//# sourceMappingURL=webhook.controller.js.map