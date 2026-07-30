"use strict";
/**
 * Voice Message Processor
 *
 * Handles incoming audio/voice messages.
 * Phase 1: Downloads audio file, returns static acknowledgment.
 * Phase 2: Downloads audio → STT (Sarvam) → AI pipeline → dynamic response.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceProcessor = void 0;
const messages_1 = require("../../config/messages");
const logger_1 = require("../../utils/logger");
class VoiceProcessor {
    constructor(whatsAppService, aiPipeline) {
        this.whatsAppService = whatsAppService;
        this.aiPipeline = aiPipeline;
    }
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
    async process(message) {
        logger_1.logger.info('Processing voice message', {
            messageId: message.messageId,
            phoneNumber: message.phoneNumber,
            mediaId: message.mediaId,
            mimeType: message.mimeType,
        });
        let audioFilePath;
        try {
            // Step 1: Download the audio file
            if (message.mediaId) {
                audioFilePath = await this.whatsAppService.downloadMedia(message.mediaId, message.mimeType);
                logger_1.logger.info('Audio file downloaded', {
                    messageId: message.messageId,
                    audioFilePath,
                });
            }
            else {
                logger_1.logger.warn('Voice message received without media ID', {
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
                reply: pipelineResult.reply || messages_1.MessageTemplates.VOICE_RECEIVED,
                source: pipelineResult.source,
                audioFilePath,
                metadata: {
                    pipelineSuccess: pipelineResult.success,
                    transcription: pipelineResult.transcription,
                    decision: pipelineResult.decision,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Voice processing failed', {
                messageId: message.messageId,
                error: error.message,
            });
            return {
                success: false,
                reply: messages_1.MessageTemplates.PROCESSING_ERROR,
                source: 'error',
                audioFilePath,
                error: error.message,
            };
        }
    }
}
exports.VoiceProcessor = VoiceProcessor;
//# sourceMappingURL=voice.processor.js.map