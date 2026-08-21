"use strict";
/**
 * Message Processor (Orchestrator)
 *
 * Routes incoming WhatsApp text/voice messages to the appropriate processor based on type.
 * Stores conversation records before and after processing, and syncs inbound/outbound messages to Supabase.
 *
 * Flow:
 *   Incoming webhook → parse → store metadata → route to processor → send reply → update metadata & Supabase
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageProcessor = void 0;
const fs_1 = __importDefault(require("fs"));
const index_1 = require("../../types/index");
const messages_1 = require("../../config/messages");
const helpers_1 = require("../../utils/helpers");
const logger_1 = require("../../utils/logger");
const supabase_1 = require("../../config/supabase");
class MessageProcessor {
    constructor(textProcessor, voiceProcessor, whatsAppService, conversationStore, ttsService) {
        this.textProcessor = textProcessor;
        this.voiceProcessor = voiceProcessor;
        this.whatsAppService = whatsAppService;
        this.conversationStore = conversationStore;
        this.ttsService = ttsService;
    }
    /**
     * Syncs a message pair (inbound user message and outbound AI reply) to Supabase conversations table.
     */
    async syncToSupabase(message, result) {
        try {
            const cleanPhone = message.phoneNumber.replace(/[^0-9]/g, '');
            // Find matching patient by phone_number if available
            const { data: patient } = await supabase_1.supabaseAdmin
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
                }
                else {
                    try {
                        inboundTimestamp = new Date(message.timestamp).toISOString();
                    }
                    catch {
                        inboundTimestamp = new Date().toISOString();
                    }
                }
            }
            // 1. Insert inbound user message
            await supabase_1.supabaseAdmin.from('conversations').insert({
                patient_id: patientId,
                phone_number: cleanPhone,
                message_id: message.messageId,
                direction: 'inbound',
                message_type: message.messageType === index_1.MessageType.AUDIO ? 'audio' : 'text',
                content: message.textContent || '',
                transcript: result.transcription?.text || '',
                audio_file_path: result.audioFilePath || '',
                timestamp: inboundTimestamp,
            });
            // 2. Insert outbound AI reply if sent
            if (result.reply) {
                await supabase_1.supabaseAdmin.from('conversations').insert({
                    patient_id: patientId,
                    phone_number: cleanPhone,
                    direction: 'outbound',
                    message_type: 'text',
                    content: result.reply,
                    timestamp: new Date().toISOString(),
                });
            }
            logger_1.logger.info('Synced conversation to Supabase', { cleanPhone, patientId });
        }
        catch (err) {
            logger_1.logger.warn('Failed to sync conversation to Supabase', {
                error: err.message,
            });
        }
    }
    /**
     * Processes an incoming message end-to-end.
     */
    async processMessage(message) {
        const procStartTime = Date.now();
        const conversationId = (0, helpers_1.generateConversationId)();
        logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=message_processor_start`);
        logger_1.logger.info('Processing message', {
            conversationId,
            messageId: message.messageId,
            phoneNumber: message.phoneNumber,
            messageType: message.messageType,
        });
        // Step 1: Store initial conversation record
        const record = {
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
        let result;
        try {
            switch (message.messageType) {
                case index_1.MessageType.TEXT:
                    result = await this.textProcessor.process(message);
                    break;
                case index_1.MessageType.AUDIO:
                    result = await this.voiceProcessor.process(message);
                    break;
                case index_1.MessageType.IMAGE:
                    logger_1.logger.info('Image message received — ignoring (not yet supported)', {
                        messageId: message.messageId,
                    });
                    result = {
                        success: true,
                        reply: messages_1.MessageTemplates.UNSUPPORTED_TYPE,
                        source: 'static',
                    };
                    break;
                default:
                    logger_1.logger.warn('Unsupported message type received', {
                        messageId: message.messageId,
                        messageType: message.messageType,
                    });
                    result = {
                        success: true,
                        reply: messages_1.MessageTemplates.UNSUPPORTED_TYPE,
                        source: 'static',
                    };
                    break;
            }
            // Step 3: Send the reply message via WhatsApp API
            if (result.reply) {
                if (message.messageType === index_1.MessageType.AUDIO && this.ttsService) {
                    const voiceReplyStart = Date.now();
                    let sentVoiceReply = false;
                    try {
                        // a. Generate TTS Audio Buffer (Sarvam Bulbul v3)
                        const ttsStart = Date.now();
                        const audioBuffer = await this.ttsService.textToSpeech(result.reply);
                        const ttsDuration = Date.now() - ttsStart;
                        logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=tts durationMs=${ttsDuration} audioSizeBytes=${audioBuffer.length}`);
                        // b. Upload media to WhatsApp Cloud API
                        const uploadStart = Date.now();
                        const mediaId = await this.whatsAppService.uploadMedia(audioBuffer);
                        const uploadDuration = Date.now() - uploadStart;
                        logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_media_upload durationMs=${uploadDuration}`);
                        // c. Send audio message to WhatsApp user
                        const sendAudioStart = Date.now();
                        await this.whatsAppService.sendAudioMessage(message.phoneNumber, mediaId);
                        const sendAudioDuration = Date.now() - sendAudioStart;
                        logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_audio_send durationMs=${sendAudioDuration}`);
                        const totalVoiceReplyDuration = Date.now() - voiceReplyStart;
                        logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=total_voice_reply durationMs=${totalVoiceReplyDuration}`);
                        logger_1.logger.info('Voice reply sent successfully via WhatsAppService', {
                            conversationId,
                            messageId: message.messageId,
                        });
                        sentVoiceReply = true;
                    }
                    catch (voiceError) {
                        const voiceFailDuration = Date.now() - voiceReplyStart;
                        logger_1.logger.warn('Voice reply flow failed, falling back to text message', {
                            conversationId,
                            messageId: message.messageId,
                            durationMs: voiceFailDuration,
                            error: voiceError.message,
                        });
                    }
                    // Fallback to text message if voice generation/upload/send failed
                    if (!sentVoiceReply) {
                        const sendStart = Date.now();
                        try {
                            await this.whatsAppService.sendTextMessage(message.phoneNumber, result.reply);
                            const sendDuration = Date.now() - sendStart;
                            logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_send_fallback durationMs=${sendDuration}`);
                            logger_1.logger.info('Text fallback reply sent via WhatsAppService', {
                                conversationId,
                                messageId: message.messageId,
                            });
                        }
                        catch (fallbackErr) {
                            logger_1.logger.error('Failed to send text fallback reply via WhatsAppService', {
                                conversationId,
                                messageId: message.messageId,
                                error: fallbackErr.message,
                            });
                        }
                    }
                }
                else {
                    // Standard TEXT message branch (or if ttsService is unavailable)
                    const sendStart = Date.now();
                    try {
                        await this.whatsAppService.sendTextMessage(message.phoneNumber, result.reply);
                        const sendDuration = Date.now() - sendStart;
                        logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_send durationMs=${sendDuration}`);
                        logger_1.logger.info('Reply sent via WhatsAppService', {
                            conversationId,
                            messageId: message.messageId,
                            replyLength: result.reply.length,
                        });
                    }
                    catch (error) {
                        const sendDuration = Date.now() - sendStart;
                        logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=whatsapp_send_failed durationMs=${sendDuration}`);
                        logger_1.logger.error('Failed to send reply via WhatsAppService', {
                            conversationId,
                            messageId: message.messageId,
                            error: error.message,
                        });
                    }
                }
            }
        }
        finally {
            // Step 4: Cleanup downloaded incoming voice temp file
            if (result?.audioFilePath && fs_1.default.existsSync(result.audioFilePath)) {
                try {
                    fs_1.default.unlinkSync(result.audioFilePath);
                    logger_1.logger.info('Cleaned up incoming voice temp file', {
                        messageId: message.messageId,
                        filePath: result.audioFilePath,
                    });
                }
                catch (cleanupErr) {
                    logger_1.logger.warn('Failed to cleanup incoming voice temp file', {
                        messageId: message.messageId,
                        filePath: result.audioFilePath,
                        error: cleanupErr.message,
                    });
                }
            }
        }
        const totalProcessingMs = Date.now() - procStartTime;
        logger_1.logger.info(`[PERF] messageId=${message.messageId} totalProcessingMs=${totalProcessingMs}`);
        // Step 4: Update conversation record with processing result & sync to DB
        const persistStart = Date.now();
        const updatedRecord = {
            ...record,
            audioFilePath: result.audioFilePath,
            processingResult: result,
        };
        await this.conversationStore.store(updatedRecord);
        // Step 5: Sync to Supabase conversations table
        await this.syncToSupabase(message, result);
        const persistenceDurationMs = Date.now() - persistStart;
        logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=persistence durationMs=${persistenceDurationMs}`);
        logger_1.logger.info('Message processing complete', {
            conversationId,
            messageId: message.messageId,
            success: result.success,
            source: result.source,
        });
        return result;
    }
}
exports.MessageProcessor = MessageProcessor;
//# sourceMappingURL=message.processor.js.map