/**
 * Voice Message Processor
 *
 * Handles incoming audio/voice messages.
 * Phase 1: Downloads audio file, returns static acknowledgment.
 * Phase 2: Downloads audio → STT (Sarvam) → AI pipeline → dynamic response.
 */

import { IMessageProcessor, ParsedMessage, ProcessingResult } from '@app-types/index';
import { WhatsAppService } from '@services/whatsapp/whatsapp.service';
import { IAIPipeline } from '@services/ai/interfaces';
import { MessageTemplates } from '@config/messages';
import { logger } from '@utils/logger';

export class VoiceProcessor implements IMessageProcessor {
  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly aiPipeline: IAIPipeline,
  ) {}

  /**
   * Processes a voice message.
   *
   * Steps:
   * 1. Download audio file from WhatsApp
   * 2. Route through AI pipeline (STT → Embedding → RAG → Decision)
   * 3. Return processing result with reply
   *
   * @param message - Parsed incoming voice message
   * @returns Processing result with reply and audio file path
   */
  async process(message: ParsedMessage): Promise<ProcessingResult> {
    logger.info('Processing voice message', {
      messageId: message.messageId,
      phoneNumber: message.phoneNumber,
      mediaId: message.mediaId,
      mimeType: message.mimeType,
    });

    let audioFilePath: string | undefined;

    try {
      // Step 1: Download the audio file
      if (message.mediaId) {
        audioFilePath = await this.whatsAppService.downloadMedia(
          message.mediaId,
          message.mimeType,
        );
        logger.info('Audio file downloaded', {
          messageId: message.messageId,
          audioFilePath,
        });
      } else {
        logger.warn('Voice message received without media ID', {
          messageId: message.messageId,
        });
      }

      // Step 2: Route through AI pipeline
      const pipelineResult = await this.aiPipeline.process({
        message,
        audioFilePath,
      });

      return {
        success: true,
        reply: pipelineResult.reply || MessageTemplates.VOICE_RECEIVED,
        source: pipelineResult.source,
        audioFilePath,
        metadata: {
          pipelineSuccess: pipelineResult.success,
          transcription: pipelineResult.transcription,
          decision: pipelineResult.decision,
        },
      };
    } catch (error) {
      logger.error('Voice processing failed', {
        messageId: message.messageId,
        error: (error as Error).message,
      });

      return {
        success: false,
        reply: MessageTemplates.PROCESSING_ERROR,
        source: 'error',
        audioFilePath,
        error: (error as Error).message,
      };
    }
  }
}
