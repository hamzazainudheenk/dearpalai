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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageProcessor = void 0;
const index_1 = require("../../types/index");
const messages_1 = require("../../config/messages");
const helpers_1 = require("../../utils/helpers");
const logger_1 = require("../../utils/logger");
const supabase_1 = require("../../config/supabase");
class MessageProcessor {
    constructor(textProcessor, voiceProcessor, whatsAppService, conversationStore) {
        this.textProcessor = textProcessor;
        this.voiceProcessor = voiceProcessor;
        this.whatsAppService = whatsAppService;
        this.conversationStore = conversationStore;
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
        const conversationId = (0, helpers_1.generateConversationId)();
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
            try {
                await this.whatsAppService.sendTextMessage(message.phoneNumber, result.reply);
                logger_1.logger.info('Reply sent via WhatsAppService', {
                    conversationId,
                    messageId: message.messageId,
                    replyLength: result.reply.length,
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to send reply via WhatsAppService', {
                    conversationId,
                    messageId: message.messageId,
                    error: error.message,
                });
            }
        }
        // Step 4: Update conversation record with processing result
        const updatedRecord = {
            ...record,
            audioFilePath: result.audioFilePath,
            processingResult: result,
        };
        await this.conversationStore.store(updatedRecord);
        // Step 5: Sync to Supabase conversations table
        await this.syncToSupabase(message, result);
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