import { IDecisionEngine, IChatService } from './interfaces';
import { DecisionResult, TranscriptionResult, RagResult, RiskAssessmentResult } from '../../types/index';
export declare class DecisionEngineService implements IDecisionEngine {
    private readonly chatService;
    constructor(chatService: IChatService);
    /**
     * Makes a decision on how to respond to a message by invoking the configured IChatService.
     *
     * @param input - Aggregated pipeline outputs (transcript or text message)
     * @returns Decision result containing AI generated reply
     */
    decide(input: {
        message: string;
        transcription?: TranscriptionResult;
        ragResult?: RagResult;
        riskAssessment?: RiskAssessmentResult;
    }): Promise<DecisionResult>;
}
//# sourceMappingURL=decision-engine.service.d.ts.map