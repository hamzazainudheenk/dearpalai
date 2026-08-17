/**
 * Webhook Controller
 *
 * Handles:
 * 1. Webhook verification
 * 2. Incoming WhatsApp messages
 * 3. WhatsApp status updates (sent, delivered, read, failed)
 */

import { Request, Response } from "express";
import { WhatsAppService } from "@services/whatsapp/whatsapp.service";
import { MessageProcessor } from "@services/processing/message.processor";
import { parseIncomingMessage } from "@utils/helpers";
import { logger } from "@utils/logger";

export class WebhookController {
  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly messageProcessor: MessageProcessor,
  ) {}

  verifyWebhook = (req: Request, res: Response): void => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    logger.info("Webhook verification attempt", { mode });

    const result = this.whatsAppService.verifyWebhook(
      mode,
      token,
      challenge,
    );

    if (result) {
      res.status(200).send(result);
    } else {
      res.status(403).json({
        status: "error",
        message: "Webhook verification failed",
      });
    }
  };

  handleWebhook = (req: Request, res: Response): void => {
    const receiveTime = Date.now();
    const ackTimestamp = new Date().toISOString();

    // Always acknowledge immediately
    res.status(200).json({
      status: "received",
    });

    const value =
      req.body?.entry?.[0]?.changes?.[0]?.value;

    /**
     * ---------------------------------------------------
     * STATUS UPDATES
     * ---------------------------------------------------
     */
    if (value?.statuses?.length) {
      for (const status of value.statuses) {
        logger.info("WhatsApp Status Update", {
          messageId: status.id,
          recipient: status.recipient_id,
          status: status.status,
          timestamp: status.timestamp,
          conversation: status.conversation,
          pricing: status.pricing,
          errors: status.errors ?? null,
        });

        if (status.errors?.length) {
          logger.error("WhatsApp Message Failed", {
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
    const parsed = parseIncomingMessage(req.body);

    if (!parsed) {
      logger.debug("Webhook event ignored", {
        object: req.body?.object,
      });
      return;
    }

    logger.info(`[PERF] messageId=${parsed.messageId} stage=webhook_ack ackDurationMs=${Date.now() - receiveTime} ackTimestamp=${ackTimestamp}`);

    logger.info("Incoming WhatsApp Message", {
      messageId: parsed.messageId,
      phoneNumber: parsed.phoneNumber,
      senderName: parsed.senderName,
      messageType: parsed.messageType,
    });

    this.messageProcessor.processMessage(parsed).catch((error) => {
      logger.error("Unhandled message processing error", {
        messageId: parsed.messageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    });
  };
}