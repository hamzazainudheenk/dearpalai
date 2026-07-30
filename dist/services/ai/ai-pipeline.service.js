"use strict";
/**
 * AI Pipeline Orchestrator (Placeholder Implementation)
 *
 * Coordinates the full AI processing flow:
 *   Voice/Text → STT (Sarvam) → Embedding → RAG → Risk Assessment → Decision Engine → Response
 *
 * Phase 1: Returns static responses from MessageTemplates.
 * Phase 2: Will orchestrate all AI services in sequence.
 *
 * All future AI processing MUST go through this service.
 * Individual processors should call the pipeline, not AI services directly.
 */
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
     * Processes a message through the full AI pipeline.
     *
     * Pipeline stages:
     * 1. Speech-to-Text (if audio)
     * 2. Generate embedding
     * 3. RAG retrieval
     * 4. Risk assessment
     * 5. Decision engine
     *
     * In Phase 1, the pipeline is disabled and returns static responses.
     * Set AI_PIPELINE_ENABLED=true in .env to activate (Phase 2).
     *
     * @param input - Pipeline input containing the parsed message and optional audio
     * @returns Pipeline output with the final reply and intermediate results
     */
    async process(input) {
        const { message, audioFilePath } = input;
        // Phase 1: Pipeline disabled — return static responses
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
        // ─── Phase 2: Full AI Pipeline ───────────────────────
        // The code below will be activated when AI_PIPELINE_ENABLED=true
        try {
            logger_1.logger.info('AI pipeline processing started', {
                messageId: message.messageId,
                messageType: message.messageType,
            });
            let messageText = message.textContent || '';
            // Stage 1: Speech-to-Text (for audio messages)
            let transcription;
            if (message.messageType === index_1.MessageType.AUDIO && audioFilePath) {
                transcription = await this.speechService.transcribe(audioFilePath);
                messageText = transcription.text;
                logger_1.logger.info('Pipeline: STT complete', {
                    confidence: transcription.confidence,
                    language: transcription.language,
                });
            }
            // Stage 2: Generate embedding
            const embeddingResult = await this.embeddingService.generateEmbedding(messageText);
            logger_1.logger.info('Pipeline: Embedding generated', {
                model: embeddingResult.model,
                tokenCount: embeddingResult.tokenCount,
            });
            // Stage 3: RAG retrieval
            const ragResult = await this.ragService.query(embeddingResult.embedding, messageText);
            logger_1.logger.info('Pipeline: RAG query complete', {
                documentsFound: ragResult.documents.length,
                hasRelevantResults: ragResult.hasRelevantResults,
            });
            // Stage 4: Risk assessment
            const riskAssessment = await this.riskAssessmentService.assess(messageText, {
                phoneNumber: message.phoneNumber,
                messageType: message.messageType,
            });
            logger_1.logger.info('Pipeline: Risk assessment complete', {
                riskLevel: riskAssessment.riskLevel,
                score: riskAssessment.score,
            });
            // Stage 5: Decision engine
            const decision = await this.decisionEngine.decide({
                message: messageText,
                transcription,
                ragResult,
                riskAssessment,
            });
            logger_1.logger.info('Pipeline: Decision made', {
                source: decision.source,
                confidence: decision.confidence,
                shouldEscalate: decision.shouldEscalate,
            });
            return {
                reply: decision.reply,
                transcription,
                ragResult,
                riskAssessment,
                decision,
                success: true,
                source: decision.source,
            };
        }
        catch (error) {
            logger_1.logger.error('AI pipeline error', {
                messageId: message.messageId,
                error: error.message,
            });
            // Fallback to static response on pipeline failure
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