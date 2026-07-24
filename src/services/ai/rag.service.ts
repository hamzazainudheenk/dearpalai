/**
 * RAG Retrieval Service (Mock Implementation)
 *
 * Phase 1: Returns empty results.
 * Phase 2: Will query a vector database (Pinecone, Weaviate, etc.)
 *          to retrieve relevant healthcare knowledge documents.
 */

import { IRagService } from './interfaces';
import { RagResult } from '@app-types/index';
import { logger } from '@utils/logger';

export class RagService implements IRagService {
  /**
   * Queries the knowledge base with an embedding vector.
   *
   * @param embedding - Query embedding vector
   * @param context - Optional context for filtering
   * @returns Mock RAG result with no documents
   */
  async query(embedding: number[], context?: string): Promise<RagResult> {
    logger.info('[Mock] RAG service called', {
      embeddingDimensions: embedding.length,
      hasContext: !!context,
    });

    // Phase 2: Replace with actual vector DB query
    // const results = await vectorDb.query({ vector: embedding, topK: aiConfig.rag.maxResults });

    return {
      documents: [],
      query: context || '',
      hasRelevantResults: false,
    };
  }
}
