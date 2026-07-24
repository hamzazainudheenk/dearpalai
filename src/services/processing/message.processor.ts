/**
 * Message Processor (Orchestrator)
 *
 * Routes incoming messages to the appropriate processor based on type.
 * Stores conversation metadata before and after processing.
 *
 * Flow:
 *   Incoming webhook → parse → store metadata → route to processor → send reply → update metadata
 */

import {
  ParsedMessage,
  ProcessingResult,
  ConversationRecord,
  MessageType,
  IConversationStore,
  IMessageProcessor,
} from '@app-types/index';
import { WhatsAppService } from '@services/whatsapp/whatsapp.service';
import { MessageTemplates } from '@config/messages';
import { generateConversationId } from '@utils/helpers';
import { logger } from '@utils/logger';

export class MessageProcessor {
  constructor(
    private readonly textProcessor: IMessageProcessor,
    private readonly voiceProcessor: IMessageProcessor,
    private readonly whatsAppService: WhatsAppService,
    private readonly conversationStore: IConversationStore,
  ) {}

  /**
   * Processes an incoming message end-to-end.
   *
   * 1. Generates a conversation ID
   * 2. Stores initial metadata
   * 3. Routes to the correct processor
   * 4. Sends the reply via WhatsApp
   * 5. Updates the conversation record with the result
   *
   * @param message - Parsed incoming message
   * @returns Processing result
   */
  async processMessage(message: ParsedMessage): Promise<ProcessingResult> {
    const conversationId = generateConversationId();

    logger.info('Processing message', {
      conversationId,
      messageId: message.messageId,
      phoneNumber: message.phoneNumber,
      messageType: message.messageType,
    });

    // Step 1: Store initial conversation record
    const record: ConversationRecord = {
      conversationId,
      messageId: message.messageId,
      phoneNumber: message.phoneNumber,
      timestamp: message.timestamp,
      messageType: message.messageType,
      content: message.textContent,
      createdAt: new Date(),
    };
    await this.conversationStore.store(record);

    // Step 2: Route to the appropriate processor
    let result: ProcessingResult;

    switch (message.messageType) {
      case MessageType.TEXT:
        result = await this.textProcessor.process(message);
        break;

      case MessageType.AUDIO:
        result = await this.voiceProcessor.process(message);
        break;

      case MessageType.IMAGE:
        logger.info('Image message received — ignoring (not yet supported)', {
          messageId: message.messageId,
        });
        result = {
          success: true,
          reply: MessageTemplates.UNSUPPORTED_TYPE,
          source: 'static',
        };
        break;

      default:
        logger.warn('Unsupported message type received', {
          messageId: message.messageId,
          messageType: message.messageType,
        });
        result = {
          success: true,
          reply: MessageTemplates.UNSUPPORTED_TYPE,
          source: 'static',
        };
        break;
    }

    // Step 3: Send the reply message
    if (result.reply) {
      try {
        await this.whatsAppService.sendTextMessage(message.phoneNumber, result.reply);
        logger.info('Reply sent', {
          conversationId,
          messageId: message.messageId,
          reply: result.reply,
        });
      } catch (error) {
        logger.error('Failed to send reply', {
          conversationId,
          messageId: message.messageId,
          error: (error as Error).message,
        });
      }
    }

    // Step 4: Update conversation record with processing result
    const updatedRecord: ConversationRecord = {
      ...record,
      audioFilePath: result.audioFilePath,
      processingResult: result,
    };
    await this.conversationStore.store(updatedRecord);

    logger.info('Message processing complete', {
      conversationId,
      messageId: message.messageId,
      success: result.success,
      source: result.source,
    });

    return result;
  }
}
