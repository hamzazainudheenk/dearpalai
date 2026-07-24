/**
 * Decision Engine Service (Mock Implementation)
 *
 * Phase 1: Returns static mock decisions.
 * Phase 2: Will synthesize outputs from RAG, risk assessment,
 *          and conversation context to generate the final response.
 */

import { IDecisionEngine } from './interfaces';
import {
  DecisionResult,
  TranscriptionResult,
  RagResult,
  RiskAssessmentResult,
} from '@app-types/index';
import { MessageTemplates } from '@config/messages';
import { logger } from '@utils/logger';

export class DecisionEngineService implements IDecisionEngine {
  /**
   * Makes a decision on how to respond to a message.
   *
   * @param input - Aggregated pipeline outputs
   * @returns Mock decision with static reply
   */
  async decide(input: {
    message: string;
    transcription?: TranscriptionResult;
    ragResult?: RagResult;
    riskAssessment?: RiskAssessmentResult;
  }): Promise<DecisionResult> {
    logger.info('[Mock] Decision engine called', {
      messageLength: input.message.length,
      hasTranscription: !!input.transcription,
      hasRagResult: !!input.ragResult,
      hasRiskAssessment: !!input.riskAssessment,
    });

    // Phase 2: Replace with actual decision logic
    // - Combine RAG results with risk assessment
    // - Apply guardrails and safety checks
    // - Generate contextual response with LLM

    return {
      reply: MessageTemplates.TEXT_RECEIVED,
      confidence: 0.0,
      source: 'mock',
      shouldEscalate: false,
      reasoning: 'Mock decision — AI pipeline not yet active',
    };
  }
}
