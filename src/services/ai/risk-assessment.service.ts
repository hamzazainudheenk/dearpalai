/**
 * Risk Assessment Service (Mock Implementation)
 *
 * Phase 1: Returns low-risk assessment for all messages.
 * Phase 2: Will analyze messages for healthcare-specific risks
 *          (e.g., emergency symptoms, suicidal ideation, adverse reactions)
 *          and trigger escalation when needed.
 */

import { IRiskAssessmentService } from './interfaces';
import { RiskAssessmentResult } from '@app-types/index';
import { logger } from '@utils/logger';

export class RiskAssessmentService implements IRiskAssessmentService {
  /**
   * Assesses the risk level of a message.
   *
   * @param message - Message text to assess
   * @param context - Additional context for assessment
   * @returns Mock low-risk assessment
   */
  async assess(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<RiskAssessmentResult> {
    logger.info('[Mock] Risk assessment called', {
      messageLength: message.length,
      hasContext: !!context,
    });

    // Phase 2: Replace with actual risk assessment logic
    // - NLP-based keyword detection
    // - LLM classification
    // - Rule-based flagging

    return {
      riskLevel: 'low',
      score: 0.0,
      flags: [],
      requiresEscalation: false,
    };
  }
}
