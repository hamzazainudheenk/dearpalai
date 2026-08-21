/**
 * Message Processor (Orchestrator)
 *
 * Routes incoming WhatsApp text/voice messages to the appropriate processor based on type.
 * Stores conversation records before and after processing, and syncs inbound/outbound messages to Supabase.
 *
 * Flow:
 *   Incoming webhook → parse → store metadata → route to processor → send reply → update metadata & Supabase
 */

import fs from 'fs';
import {
  ParsedMessage,
  ProcessingResult,
  ConversationRecord,
  MessageType,
  IConversationStore,
  IMessageProcessor,
} from '@app-types/index';
import { WhatsAppService } from '@services/whatsapp/whatsapp.service';
import { ITextToSpeechService } from '@services/ai/interfaces';
import { MessageTemplates } from '@config/messages';
import { generateConversationId } from '@utils/helpers';
import { logger } from '@utils/logger';
import { supabaseAdmin } from '@config/supabase';

export class MessageProcessor {
  constructor(
    private readonly textProcessor: IMessageProcessor,
    private readonly voiceProcessor: IMessageProcessor,
    private readonly whatsAppService: WhatsAppService,
    private readonly conversationStore: IConversationStore,
    private readonly ttsService?: ITextToSpeechService
  ) {}

  /**
   * Syncs a message pair (inbound user message and outbound AI reply) to Supabase conversations table.
   */
  private async syncToSupabase(
    message: ParsedMessage,
    result: ProcessingResult
  ): Promise<void> {
    try {
      const cleanPhone = message.phoneNumber.replace(/[^0-9]/g, '');

      // Find matching patient by phone_number if available
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('phone_number', cleanPhone)
        .maybeSingle();

      const patientId = patient?.id || null;

      let inboundTimestamp = new Date().toISOString();
      if (message.timestamp) {
        const num = parseInt(message.timestamp, 10);
        if (!isNaN(num) && num > 1000000000) {
          inboundTimestamp = new Date(num * 1000).toISOString();
        } else {
          try {
            inboundTimestamp = new Date(message.timestamp).toISOString();
          } catch {
            inboundTimestamp = new Date().toISOString();
          }
        }
      }

      // 1. Insert inbound user message
      await supabaseAdmin.from('conversations').insert({
        patient_id: patientId,
        phone_number: cleanPhone,
        message_id: message.messageId,
        direction: 'inbound',
        message_type: message.messageType === MessageType.AUDIO ? 'audio' : 'text',
        content: message.textContent || '',
        transcript: result.transcription?.text || '',
        audio_file_path: result.audioFilePath || '',
        timestamp: inboundTimestamp,
      });

      // 2. Insert outbound AI reply if sent
      if (result.reply) {
        await supabaseAdmin.from('conversations').insert({
          patient_id: patientId,
          phone_number: cleanPhone,
          direction: 'outbound',
          message_type: 'text',
          content: result.reply,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('Synced conversation to Supabase', { cleanPhone, patientId });
    } catch (err) {
      logger.warn('Failed to sync conversation to Supabase', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Processes an incoming message end-to-end.
   */
  async processMessage(message: ParsedMessage): Promise<ProcessingResult> {
    const procStartTime = Date.now();
    const conversationId = generateConversationId();

    logger.info(`[PERF] messageId=${message.messageId} stage=message_processor_start`);

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
    let result!: ProcessingResult;

    try {
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

      // Step 3: Send the reply message via WhatsApp API
      if (result.reply) {
        if (message.messageType === MessageType.AUDIO && this.ttsService) {
          const voiceReplyStart = Date.now();
          let sentVoiceReply = false;

          try {
            // a. Generate TTS Audio Buffer (Sarvam Bulbul v3)
            const ttsStart = Date.now();
            const audioBuffer = await this.ttsService.textToSpeech(result.reply);
            const ttsDuration = Date.now() - ttsStart;
            logger.info(`[PERF] messageId=${message.messageId} stage=tts durationMs=${ttsDuration} audioSizeBytes=${audioBuffer.length}`);

            // b. Upload media to WhatsApp Cloud API
            const uploadStart = Date.now();
            const mediaId = await this.whatsAppService.uploadMedia(audioBuffer);
            const uploadDuration = Date.now() - uploadStart;
            logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_media_upload durationMs=${uploadDuration}`);

            // c. Send audio message to WhatsApp user
            const sendAudioStart = Date.now();
            await this.whatsAppService.sendAudioMessage(message.phoneNumber, mediaId);
            const sendAudioDuration = Date.now() - sendAudioStart;
            logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_audio_send durationMs=${sendAudioDuration}`);

            const totalVoiceReplyDuration = Date.now() - voiceReplyStart;
            logger.info(`[PERF] messageId=${message.messageId} stage=total_voice_reply durationMs=${totalVoiceReplyDuration}`);
            logger.info('Voice reply sent successfully via WhatsAppService', {
              conversationId,
              messageId: message.messageId,
            });

            sentVoiceReply = true;
          } catch (voiceError) {
            const voiceFailDuration = Date.now() - voiceReplyStart;
            logger.warn('Voice reply flow failed, falling back to text message', {
              conversationId,
              messageId: message.messageId,
              durationMs: voiceFailDuration,
              error: (voiceError as Error).message,
            });
          }

          // Fallback to text message if voice generation/upload/send failed
          if (!sentVoiceReply) {
            const sendStart = Date.now();
            try {
              await this.whatsAppService.sendTextMessage(message.phoneNumber, result.reply);
              const sendDuration = Date.now() - sendStart;
              logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_send_fallback durationMs=${sendDuration}`);
              logger.info('Text fallback reply sent via WhatsAppService', {
                conversationId,
                messageId: message.messageId,
              });
            } catch (fallbackErr) {
              logger.error('Failed to send text fallback reply via WhatsAppService', {
                conversationId,
                messageId: message.messageId,
                error: (fallbackErr as Error).message,
              });
            }
          }
        } else {
          // Standard TEXT message branch (or if ttsService is unavailable)
          const sendStart = Date.now();
          try {
            await this.whatsAppService.sendTextMessage(message.phoneNumber, result.reply);
            const sendDuration = Date.now() - sendStart;
            logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_send durationMs=${sendDuration}`);
            logger.info('Reply sent via WhatsAppService', {
              conversationId,
              messageId: message.messageId,
              replyLength: result.reply.length,
            });
          } catch (error) {
            const sendDuration = Date.now() - sendStart;
            logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_send_failed durationMs=${sendDuration}`);
            logger.error('Failed to send reply via WhatsAppService', {
              conversationId,
              messageId: message.messageId,
              error: (error as Error).message,
            });
          }
        }
      }
    } finally {
      // Step 4: Cleanup downloaded incoming voice temp file
      if (result?.audioFilePath && fs.existsSync(result.audioFilePath)) {
        try {
          fs.unlinkSync(result.audioFilePath);
          logger.info('Cleaned up incoming voice temp file', {
            messageId: message.messageId,
            filePath: result.audioFilePath,
          });
        } catch (cleanupErr) {
          logger.warn('Failed to cleanup incoming voice temp file', {
            messageId: message.messageId,
            filePath: result.audioFilePath,
            error: (cleanupErr as Error).message,
          });
        }
      }
    }

    const totalProcessingMs = Date.now() - procStartTime;
    logger.info(`[PERF] messageId=${message.messageId} totalProcessingMs=${totalProcessingMs}`);

    // Step 4: Update conversation record with processing result & sync to DB
    const persistStart = Date.now();
    const updatedRecord: ConversationRecord = {
      ...record,
      audioFilePath: result.audioFilePath,
      processingResult: result,
    };
    await this.conversationStore.store(updatedRecord);

    // Step 5: Sync to Supabase conversations table
    await this.syncToSupabase(message, result);

    const persistenceDurationMs = Date.now() - persistStart;
    logger.info(`[PERF] messageId=${message.messageId} stage=persistence durationMs=${persistenceDurationMs}`);

    logger.info('Message processing complete', {
      conversationId,
      messageId: message.messageId,
      success: result.success,
      source: result.source,
    });

    return result;
  }
}
