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
import { ISpeechService, IEmbeddingService, IRagService, IRiskAssessmentService, IDecisionEngine, IAIPipeline } from './interfaces';
import { AIPipelineInput, AIPipelineOutput } from '../../types/index';
export declare class AIPipelineService implements IAIPipeline {
    private readonly speechService;
    private readonly embeddingService;
    private readonly ragService;
    private readonly riskAssessmentService;
    private readonly decisionEngine;
    constructor(speechService: ISpeechService, embeddingService: IEmbeddingService, ragService: IRagService, riskAssessmentService: IRiskAssessmentService, decisionEngine: IDecisionEngine);
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
    process(input: AIPipelineInput): Promise<AIPipelineOutput>;
}
//# sourceMappingURL=ai-pipeline.service.d.ts.map