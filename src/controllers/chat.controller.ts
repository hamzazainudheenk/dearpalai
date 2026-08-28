import { Response } from 'express';
import { ChatService } from '@services/chat.service';
import { AuthenticatedChatRequest } from '@middleware/auth.middleware';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

const ALLOWED_SCOPES = new Set(['patient', 'caretaker']);

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /api/chat/message
   * `conversationScope` in the body must match the authenticated identity
   * — it is never trusted as the authority for which conversation this
   * request can read/write. See `authenticateChatIdentity`.
   */
  message = async (req: AuthenticatedChatRequest, res: Response): Promise<void> => {
    try {
      const identity = req.chatIdentity;
      if (!identity) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const { message, conversationScope } = req.body || {};

      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Message is required.' });
        return;
      }

      if (typeof conversationScope !== 'string' || !ALLOWED_SCOPES.has(conversationScope)) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'conversationScope must be "patient" or "caretaker".',
        });
        return;
      }

      if (conversationScope !== identity.type) {
        res.status(403).json({
          status: 'error',
          code: 'SCOPE_MISMATCH',
          message: 'You are not authorized for this conversation scope.',
        });
        return;
      }

      const result = await this.chatService.sendMessage(identity, message);
      res.status(200).json({
        status: 'success',
        data: {
          reply: result.reply,
          ...(result.detectedSymptoms && { detectedSymptoms: result.detectedSymptoms }),
        },
      });
    } catch (err) {
      this.handleError(err, res, 'message');
    }
  };

  /**
   * POST /api/chat/voice
   * multipart/form-data: `audio` file field + `conversationScope` field.
   */
  voice = async (req: AuthenticatedChatRequest, res: Response): Promise<void> => {
    try {
      const identity = req.chatIdentity;
      if (!identity) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const conversationScope = (req.body || {}).conversationScope;
      if (typeof conversationScope !== 'string' || !ALLOWED_SCOPES.has(conversationScope)) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'conversationScope must be "patient" or "caretaker".',
        });
        return;
      }

      if (conversationScope !== identity.type) {
        res.status(403).json({
          status: 'error',
          code: 'SCOPE_MISMATCH',
          message: 'You are not authorized for this conversation scope.',
        });
        return;
      }

      const file = (req as unknown as { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: 'Audio file is required.' });
        return;
      }

      const result = await this.chatService.sendVoiceMessage(identity, file.buffer, file.mimetype || 'audio/m4a');
      res.status(200).json({
        status: 'success',
        data: {
          transcript: result.transcript,
          reply: result.reply,
          ...(result.detectedSymptoms && { detectedSymptoms: result.detectedSymptoms }),
          ...(result.audioBase64 && { audioBase64: result.audioBase64, audioMimeType: result.audioMimeType }),
        },
      });
    } catch (err) {
      this.handleError(err, res, 'voice');
    }
  };

  /**
   * GET /api/chat/history
   * Scoped to the authenticated identity.
   */
  history = async (req: AuthenticatedChatRequest, res: Response): Promise<void> => {
    try {
      const identity = req.chatIdentity;
      if (!identity) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const scope = req.query.conversationScope as string | undefined;
      if (scope && scope !== identity.type) {
        res.status(403).json({
          status: 'error',
          code: 'SCOPE_MISMATCH',
          message: 'You are not authorized for this conversation scope.',
        });
        return;
      }

      const messages = await this.chatService.getHistory(identity);
      res.status(200).json({ status: 'success', data: { messages } });
    } catch (err) {
      this.handleError(err, res, 'history');
    }
  };

  private handleError(err: unknown, res: Response, action: string): void {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        status: 'error',
        ...(err.code && { code: err.code }),
        message: err.message,
      });
      return;
    }
    logger.error(`Unhandled error in ChatController.${action}`, { error: (err as Error).message });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}
