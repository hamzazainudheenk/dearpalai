import {
  ISpeechService,
  IEmbeddingService,
  IRiskAssessmentService,
  IDecisionEngine,
  IAIPipeline,
} from './interfaces';
import { RAGService } from '@services/knowledge/rag.service';
import { AIPipelineInput, AIPipelineOutput, MessageType } from '@app-types/index';
import { MessageTemplates } from '@config/messages';
import { aiConfig } from '@config/ai';
import { logger } from '@utils/logger';

export class AIPipelineService implements IAIPipeline {
  constructor(
    private readonly speechService: ISpeechService,
    private readonly embeddingService: IEmbeddingService,
    private readonly ragService: RAGService,
    private readonly riskAssessmentService: IRiskAssessmentService,
    private readonly decisionEngine: IDecisionEngine
  ) {}

  /**
   * Processes an incoming WhatsApp text or voice message through the production AI pipeline.
   *
   * Flow:
   * 1. Speech-to-Text (if voice message)
   * 2. RAG Retrieval + Context Assembly + LLM Generation
   * 3. Risk/Safety Assessment
   * 4. WhatsApp Response Formatting
   */
  async process(input: AIPipelineInput): Promise<AIPipelineOutput> {
    const { message, audioFilePath } = input;

    // Fallback if pipeline explicitly disabled in config
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

    try {
      logger.info('AI pipeline processing started', {
        messageId: message.messageId,
        messageType: message.messageType,
      });

      let messageText = message.textContent || '';

      // Stage 1: Speech-to-Text (for audio messages)
      let transcription;
      if (message.messageType === MessageType.AUDIO && audioFilePath) {
        const sttStart = Date.now();
        transcription = await this.speechService.transcribe(audioFilePath);
        const sttDurationMs = Date.now() - sttStart;
        logger.info(`[PERF] messageId=${message.messageId} stage=stt durationMs=${sttDurationMs}`);
        messageText = transcription.text;
        logger.info('Pipeline: STT complete', {
          confidence: transcription.confidence,
          language: transcription.language,
        });
      }

      // Stage 3: RAG Retrieval + LLM Generation
      logger.info('Pipeline: RAGService query started', { messageTextLength: messageText.length });
      const ragStart = Date.now();
      const ragResponse = await this.ragService.generateAnswer(messageText, {
        messageId: message.messageId,
        phoneNumber: message.phoneNumber,
      });
      const ragDurationMs = Date.now() - ragStart;
      logger.info(`[PERF] messageId=${message.messageId} stage=rag_total durationMs=${ragDurationMs}`);

      logger.info('Pipeline: RAGService query complete', {
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
      logger.info(`[PERF] messageId=${message.messageId} stage=risk_assessment durationMs=${riskDurationMs}`);
      logger.info('Pipeline: Risk assessment complete', {
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
    } catch (error) {
      logger.error('AI pipeline processing error', {
        messageId: message.messageId,
        error: (error as Error).message,
      });

      return {
        reply: MessageTemplates.PROCESSING_ERROR,
        success: false,
        source: 'error',
      };
    }
  }
}
