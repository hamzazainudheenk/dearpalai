/**
 * Text Message Processor
 *
 * Handles incoming text messages.
 * Phase 1: Returns a static acknowledgment from MessageTemplates.
 * Phase 2: Will route through the AI pipeline for intelligent responses.
 */

import { IMessageProcessor, ParsedMessage, ProcessingResult } from '@app-types/index';
import { IAIPipeline } from '@services/ai/interfaces';
import { MessageTemplates } from '@config/messages';
import { logger } from '@utils/logger';

export class TextProcessor implements IMessageProcessor {
  constructor(private readonly aiPipeline: IAIPipeline) {}

  /**
   * Processes a text message.
   *
   * @param message - Parsed incoming text message
   * @returns Processing result with reply
   */
  async process(message: ParsedMessage): Promise<ProcessingResult> {
    logger.info('Processing text message', {
      messageId: message.messageId,
      phoneNumber: message.phoneNumber,
      textLength: message.textContent?.length || 0,
    });

    try {
      // Route through AI pipeline (returns static response in Phase 1)
      const pipelineResult = await this.aiPipeline.process({ message });

      return {
        success: true,
        reply: pipelineResult.reply || MessageTemplates.TEXT_RECEIVED,
        source: pipelineResult.source,
        metadata: {
          pipelineSuccess: pipelineResult.success,
          decision: pipelineResult.decision,
        },
      };
    } catch (error) {
      logger.error('Text processing failed', {
        messageId: message.messageId,
        error: (error as Error).message,
      });

      return {
        success: false,
        reply: MessageTemplates.PROCESSING_ERROR,
        source: 'error',
        error: (error as Error).message,
      };
    }
  }
}
