/**
 * Embedding Service (Mock Implementation)
 *
 * Phase 1: Returns a zero vector.
 * Phase 2: Will integrate with OpenAI or other embedding providers
 *          to generate text embeddings for RAG retrieval.
 */

import { IEmbeddingService } from './interfaces';
import { EmbeddingResult } from '@app-types/index';
import { aiConfig } from '@config/ai';
import { logger } from '@utils/logger';

export class EmbeddingService implements IEmbeddingService {
  /**
   * Generates an embedding vector from text.
   *
   * @param text - Input text to embed
   * @returns Mock embedding result with zero vector
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    logger.info('[Mock] Embedding service called', {
      textLength: text.length,
      provider: aiConfig.embedding.provider,
    });

    // Phase 2: Replace with actual embedding API call
    // const response = await openai.embeddings.create({ input: text, model: aiConfig.embedding.model });

    return {
      embedding: new Array(aiConfig.embedding.dimensions).fill(0),
      model: aiConfig.embedding.model,
      tokenCount: 0,
    };
  }
}
