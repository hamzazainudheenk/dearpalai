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

import {
  ISpeechService,
  IEmbeddingService,
  IRagService,
  IRiskAssessmentService,
  IDecisionEngine,
  IAIPipeline,
} from './interfaces';
import { AIPipelineInput, AIPipelineOutput, MessageType } from '@app-types/index';
import { MessageTemplates } from '@config/messages';
import { aiConfig } from '@config/ai';
import { logger } from '@utils/logger';

export class AIPipelineService implements IAIPipeline {
  constructor(
    private readonly speechService: ISpeechService,
    private readonly embeddingService: IEmbeddingService,
    private readonly ragService: IRagService,
    private readonly riskAssessmentService: IRiskAssessmentService,
    private readonly decisionEngine: IDecisionEngine,
  ) {}

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
  async process(input: AIPipelineInput): Promise<AIPipelineOutput> {
    const { message, audioFilePath } = input;

    // Phase 1: Pipeline disabled — return static responses
    if (!aiConfig.pipeline.enabled) {
      logger.info('AI pipeline disabled, returning static response', {
        messageId: message.messageId,
        messageType: message.messageType,
      });

      const reply =
        message.messageType === MessageType.AUDIO
          ? MessageTemplates.VOICE_RECEIVED
          : MessageTemplates.TEXT_RECEIVED;

      return {
        reply,
        success: true,
        source: 'static',
      };
    }

    // ─── Phase 2: Full AI Pipeline ───────────────────────
    // The code below will be activated when AI_PIPELINE_ENABLED=true

    try {
      logger.info('AI pipeline processing started', {
        messageId: message.messageId,
        messageType: message.messageType,
      });

      let messageText = message.textContent || '';

      // Stage 1: Speech-to-Text (for audio messages)
      let transcription;
      if (message.messageType === MessageType.AUDIO && audioFilePath) {
        transcription = await this.speechService.transcribe(audioFilePath);
        messageText = transcription.text;
        logger.info('Pipeline: STT complete', {
          confidence: transcription.confidence,
          language: transcription.language,
        });
      }

      // Stage 2: Generate embedding
      const embeddingResult = await this.embeddingService.generateEmbedding(messageText);
      logger.info('Pipeline: Embedding generated', {
        model: embeddingResult.model,
        tokenCount: embeddingResult.tokenCount,
      });

      // Stage 3: RAG retrieval
      const ragResult = await this.ragService.query(
        embeddingResult.embedding,
        messageText,
      );
      logger.info('Pipeline: RAG query complete', {
        documentsFound: ragResult.documents.length,
        hasRelevantResults: ragResult.hasRelevantResults,
      });

      // Stage 4: Risk assessment
      const riskAssessment = await this.riskAssessmentService.assess(messageText, {
        phoneNumber: message.phoneNumber,
        messageType: message.messageType,
      });
      logger.info('Pipeline: Risk assessment complete', {
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
      logger.info('Pipeline: Decision made', {
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
    } catch (error) {
      logger.error('AI pipeline error', {
        messageId: message.messageId,
        error: (error as Error).message,
      });

      // Fallback to static response on pipeline failure
      return {
        reply: MessageTemplates.PROCESSING_ERROR,
        success: false,
        source: 'error',
      };
    }
  }
}
