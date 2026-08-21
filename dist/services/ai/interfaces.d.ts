/**
 * AI Service Interfaces
 *
 * Defines contracts for all AI services used in the DearPal pipeline.
 * Phase 1 uses mock implementations; Phase 2 will swap in real services
 * via the DI container — no processor or controller changes needed.
 */
import { TranscriptionResult, EmbeddingResult, RagResult, RiskAssessmentResult, DecisionResult, AIPipelineInput, AIPipelineOutput } from '../../types/index';
/**
 * Speech-to-Text service interface.
 * Converts audio files to text transcriptions.
 */
export interface ISpeechService {
    /** Transcribe an audio file to text */
    transcribe(audioPath: string): Promise<TranscriptionResult>;
}
/**
 * Embedding service interface.
 * Generates vector embeddings from text for similarity search.
 */
export interface IEmbeddingService {
    /** Generate an embedding vector from text */
    generateEmbedding(text: string): Promise<EmbeddingResult>;
}
/**
 * RAG (Retrieval-Augmented Generation) service interface.
 * Retrieves relevant documents from a vector store.
 */
export interface IRagService {
    /** Query the knowledge base with an embedding */
    query(embedding: number[], context?: string): Promise<RagResult>;
}
/**
 * Risk assessment service interface.
 * Evaluates messages for healthcare-related risks.
 */
export interface IRiskAssessmentService {
    /** Assess the risk level of a message */
    assess(message: string, context?: Record<string, unknown>): Promise<RiskAssessmentResult>;
}
/**
 * Decision engine service interface.
 * Determines the final response based on all pipeline outputs.
 */
export interface IDecisionEngine {
    /** Make a decision on how to respond */
    decide(input: {
        message: string;
        transcription?: TranscriptionResult;
        ragResult?: RagResult;
        riskAssessment?: RiskAssessmentResult;
    }): Promise<DecisionResult>;
}
/**
 * Text-to-Speech service interface.
 * Converts text into spoken audio buffer.
 */
export interface ITextToSpeechService {
    /** Convert text into spoken audio Buffer */
    textToSpeech(text: string): Promise<Buffer>;
}
/**
 * AI Pipeline orchestrator interface.
 * Coordinates the full AI processing flow:
 * STT → Embedding → RAG → Risk Assessment → Decision Engine
 */
export interface IAIPipeline {
    /** Process a message through the full AI pipeline */
    process(input: AIPipelineInput): Promise<AIPipelineOutput>;
}
//# sourceMappingURL=interfaces.d.ts.map