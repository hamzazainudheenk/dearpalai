"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIPipelineService = void 0;
const index_1 = require("../../types/index");
const messages_1 = require("../../config/messages");
const ai_1 = require("../../config/ai");
const logger_1 = require("../../utils/logger");
class AIPipelineService {
    constructor(speechService, embeddingService, ragService, riskAssessmentService, decisionEngine) {
        this.speechService = speechService;
        this.embeddingService = embeddingService;
        this.ragService = ragService;
        this.riskAssessmentService = riskAssessmentService;
        this.decisionEngine = decisionEngine;
    }
    /**
     * Processes an incoming WhatsApp text or voice message through the production AI pipeline.
     *
     * Flow:
     * 1. Speech-to-Text (if voice message)
     * 2. RAG Retrieval + Context Assembly + LLM Generation
     * 3. Risk/Safety Assessment
     * 4. WhatsApp Response Formatting
     */
    async process(input) {
        const { message, audioFilePath } = input;
        // Fallback if pipeline explicitly disabled in config
        if (!ai_1.aiConfig.pipeline.enabled) {
            logger_1.logger.info('AI pipeline disabled, returning static response', {
                messageId: message.messageId,
                messageType: message.messageType,
            });
            const reply = message.messageType === index_1.MessageType.AUDIO
                ? messages_1.MessageTemplates.VOICE_RECEIVED
                : messages_1.MessageTemplates.TEXT_RECEIVED;
            return {
                reply,
                success: true,
                source: 'static',
            };
        }
        try {
            logger_1.logger.info('AI pipeline processing started', {
                messageId: message.messageId,
                messageType: message.messageType,
            });
            let messageText = message.textContent || '';
            // Stage 1: Speech-to-Text (for audio messages)
            let transcription;
            if (message.messageType === index_1.MessageType.AUDIO && audioFilePath) {
                const sttStart = Date.now();
                transcription = await this.speechService.transcribe(audioFilePath);
                const sttDurationMs = Date.now() - sttStart;
                logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=stt durationMs=${sttDurationMs}`);
                messageText = transcription.text;
                logger_1.logger.info('Pipeline: STT complete', {
                    confidence: transcription.confidence,
                    language: transcription.language,
                });
            }
            // Stage 3: RAG Retrieval + LLM Generation
            logger_1.logger.info('Pipeline: RAGService query started', { messageTextLength: messageText.length });
            const ragStart = Date.now();
            const ragResponse = await this.ragService.generateAnswer(messageText, {
                messageId: message.messageId,
                phoneNumber: message.phoneNumber,
            });
            const ragDurationMs = Date.now() - ragStart;
            logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=rag_total durationMs=${ragDurationMs}`);
            logger_1.logger.info('Pipeline: RAGService query complete', {
                answerLength: ragResponse.answer?.length || 0,
                sourcesCount: ragResponse.sources?.length || 0,
            });
            // Stage 4: Safety / Risk Assessment
            const riskStart = Date.now();
            const riskAssessment = await this.riskAssessmentService.assess(messageText, {
                phoneNumber: message.phoneNumber,
                messageType: message.messageType,
            });
            const riskDurationMs = Date.now() - riskStart;
            logger_1.logger.info(`[PERF] messageId=${message.messageId} stage=risk_assessment durationMs=${riskDurationMs}`);
            logger_1.logger.info('Pipeline: Risk assessment complete', {
                riskLevel: riskAssessment.riskLevel,
                score: riskAssessment.score,
            });
            // Stage 5: Decision engine format output
            const sourceTag = ragResponse.sources.length > 0 ? 'rag' : 'fallback';
            return {
                reply: ragResponse.answer,
                transcription,
                riskAssessment,
                success: true,
                source: sourceTag,
                metadata: {
                    sources: ragResponse.sources,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('AI pipeline processing error', {
                messageId: message.messageId,
                error: error.message,
            });
            return {
                reply: messages_1.MessageTemplates.PROCESSING_ERROR,
                success: false,
                source: 'error',
            };
        }
    }
}
exports.AIPipelineService = AIPipelineService;
//# sourceMappingURL=ai-pipeline.service.js.map