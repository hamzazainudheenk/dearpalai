/**
 * Embedding Service (Mock Implementation)
 *
 * Phase 1: Returns a zero vector.
 * Phase 2: Will integrate with OpenAI or other embedding providers
 *          to generate text embeddings for RAG retrieval.
 */
import { IEmbeddingService } from './interfaces';
import { EmbeddingResult } from '../../types/index';
export declare class EmbeddingService implements IEmbeddingService {
    /**
     * Generates an embedding vector from text.
     *
     * @param text - Input text to embed
     * @returns Mock embedding result with zero vector
     */
    generateEmbedding(text: string): Promise<EmbeddingResult>;
}
//# sourceMappingURL=embedding.service.d.ts.map