import { ISpeechService, IEmbeddingService, IRiskAssessmentService, IDecisionEngine, IAIPipeline } from './interfaces';
import { RAGService } from '../knowledge/rag.service';
import { AIPipelineInput, AIPipelineOutput } from '../../types/index';
export declare class AIPipelineService implements IAIPipeline {
    private readonly speechService;
    private readonly embeddingService;
    private readonly ragService;
    private readonly riskAssessmentService;
    private readonly decisionEngine;
    constructor(speechService: ISpeechService, embeddingService: IEmbeddingService, ragService: RAGService, riskAssessmentService: IRiskAssessmentService, decisionEngine: IDecisionEngine);
    /**
     * Fast intent check for conversational greetings.
     */
    private isGreeting;
    /**
     * Processes an incoming WhatsApp text or voice message through the production AI pipeline.
     *
     * Flow:
     * 1. Speech-to-Text (if voice message)
     * 2. Greeting Intent Check (Fast path: returns greeting without calling RAG / Sarvam 105B)
     * 3. RAG Retrieval + Context Assembly + Sarvam 105B Generation
     * 4. Risk/Safety Assessment
     * 5. WhatsApp Response Formatting
     */
    process(input: AIPipelineInput): Promise<AIPipelineOutput>;
}
//# sourceMappingURL=ai-pipeline.service.d.ts.map