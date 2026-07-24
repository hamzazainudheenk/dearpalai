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
import { WhatsAppService } from '@services/whatsapp/whatsapp.service';
import { MessageProcessor } from '@services/processing/message.processor';
import { parseIncomingMessage } from '@utils/helpers';
import { logger } from '@utils/logger';

export class WebhookController {
  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly messageProcessor: MessageProcessor,
  ) {}

  /**
   * GET /webhook — Meta webhook verification.
   *
   * Validates the verify token and returns the challenge
   * to complete the webhook subscription handshake.
   */
  verifyWebhook = (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    logger.info('Webhook verification attempt', { mode });

    const result = this.whatsAppService.verifyWebhook(mode, token, challenge);

    if (result) {
      res.status(200).send(result);
    } else {
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
  handleWebhook = (req: Request, res: Response): void => {
    // Respond immediately — WhatsApp requires a fast response
    res.status(200).json({ status: 'received' });

    // Parse the incoming message
    const parsed = parseIncomingMessage(req.body);

    if (!parsed) {
      logger.debug('Webhook received non-message event (status update, etc.)', {
        object: req.body?.object,
        hasMessages: !!req.body?.entry?.[0]?.changes?.[0]?.value?.messages,
      });
      return;
    }

    logger.info('Incoming message received', {
      messageId: parsed.messageId,
      phoneNumber: parsed.phoneNumber,
      messageType: parsed.messageType,
      senderName: parsed.senderName,
    });

    // Fire-and-forget: process asynchronously
    // Errors are caught and logged internally by MessageProcessor
    this.messageProcessor.processMessage(parsed).catch((error) => {
      logger.error('Unhandled error in message processing', {
        messageId: parsed.messageId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    });
  };
}
