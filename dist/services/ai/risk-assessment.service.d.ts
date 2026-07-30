/**
 * Risk Assessment Service (Mock Implementation)
 *
 * Phase 1: Returns low-risk assessment for all messages.
 * Phase 2: Will analyze messages for healthcare-specific risks
 *          (e.g., emergency symptoms, suicidal ideation, adverse reactions)
 *          and trigger escalation when needed.
 */
import { IRiskAssessmentService } from './interfaces';
import { RiskAssessmentResult } from '../../types/index';
export declare class RiskAssessmentService implements IRiskAssessmentService {
    /**
     * Assesses the risk level of a message.
     *
     * @param message - Message text to assess
     * @param context - Additional context for assessment
     * @returns Mock low-risk assessment
     */
    assess(message: string, context?: Record<string, unknown>): Promise<RiskAssessmentResult>;
}
//# sourceMappingURL=risk-assessment.service.d.ts.map