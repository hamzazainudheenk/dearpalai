import { IDecisionEngine } from './interfaces';
import { DecisionResult, TranscriptionResult, RagResult, RiskAssessmentResult } from '../../types/index';
import { SarvamChatService } from './sarvam-chat.service';
export declare class DecisionEngineService implements IDecisionEngine {
    private readonly sarvamChatService;
    constructor(sarvamChatService: SarvamChatService);
    /**
     * Makes a decision on how to respond to a message by invoking SarvamChatService.
     *
     * @param input - Aggregated pipeline outputs (transcript or text message)
     * @returns Decision result containing Sarvam AI generated reply
     */
    decide(input: {
        message: string;
        transcription?: TranscriptionResult;
        ragResult?: RagResult;
        riskAssessment?: RiskAssessmentResult;
    }): Promise<DecisionResult>;
}
//# sourceMappingURL=decision-engine.service.d.ts.map