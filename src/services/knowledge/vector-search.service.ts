import { EmbeddingService } from './embedding.service';
import { supabaseAdmin } from '@config/supabase';
import { aiConfig } from '@config/ai';
import { logger } from '@utils/logger';

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentCategory: string;
  chunkNumber: number;
  chunkText: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface VectorSearchOptions {
  topK?: number;
  threshold?: number;
}

export class VectorSearchService {
  private embeddingService = new EmbeddingService();

  /**
   * Performs vector similarity retrieval for a patient/user question:
   * Patient Question (Malayalam / English / Mixed) → OpenAI text-embedding-3-small Query Embedding (384-dim) → pgvector Similarity Search → Relevant English Chunks
   */
  async searchSimilarChunks(
    queryText: string,
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    const trimmedQuery = queryText?.trim();
    if (!trimmedQuery) {
      throw new Error('Search query text cannot be empty');
    }

    const topK = Math.max(1, Math.min(100, options?.topK ?? aiConfig.rag.maxResults));
    const threshold = options?.threshold ?? aiConfig.rag.similarityThreshold;

    logger.info('Vector search started', { queryLength: trimmedQuery.length, topK, threshold });

    // 1. Generate query embedding using OpenAI text-embedding-3-small (384 dimensions)
    const embeddingResult = await this.embeddingService.getEmbedding(trimmedQuery);
    const queryEmbedding = embeddingResult.embedding;

    // 2. Validate embedding dimensions (384-dim target for OpenAI text-embedding-3-small)
    const targetDimensions = aiConfig.embedding.dimensions;
    if (!queryEmbedding || queryEmbedding.length !== targetDimensions) {
      logger.error('Query embedding dimension mismatch', {
        expected: targetDimensions,
        received: queryEmbedding?.length,
      });
      throw new Error(`Embedding dimension mismatch: expected ${targetDimensions}, received ${queryEmbedding?.length || 0}`);
    }

    logger.info('Query embedding generated', {
      model: embeddingResult.model,
      dimensions: queryEmbedding.length,
    });

    // 3. Count approved & completed documents available in system
    const { count: approvedDocCount } = await supabaseAdmin
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .eq('approved', true);

    logger.info(`Number of approved documents available: ${approvedDocCount || 0}`);

    if (!approvedDocCount || approvedDocCount === 0) {
      logger.info('No relevant knowledge found (no approved completed documents in database)');
      return [];
    }

    // 4. Execute pgvector cosine similarity RPC query in PostgreSQL
    const { data: rpcResults, error: rpcError } = await supabaseAdmin.rpc('match_knowledge_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: topK,
      similarity_threshold: threshold,
    });

    if (rpcError) {
      logger.error('Supabase pgvector RPC search failed', { error: rpcError.message });
      throw new Error(`Vector similarity search failed: ${rpcError.message}`);
    }

    const matches = rpcResults || [];

    if (matches.length === 0) {
      logger.info('No relevant knowledge found (no chunks met similarity threshold)');
      return [];
    }

    const topScore = matches[0]?.similarity_score ? Number(matches[0].similarity_score.toFixed(4)) : 0;
    logger.info('Vector search completed', {
      numberOfResults: matches.length,
      topSimilarityScore: topScore,
    });

    // 5. Format results
    const results: VectorSearchResult[] = matches.map((m: any) => ({
      chunkId: m.chunk_id,
      documentId: m.document_id,
      documentTitle: m.document_title,
      documentCategory: m.document_category,
      chunkNumber: m.chunk_number,
      chunkText: m.chunk_text,
      similarity: Number(m.similarity_score ? Number(m.similarity_score).toFixed(4) : 0),
      metadata: m.metadata || {},
    }));

    return results;
  }
}
