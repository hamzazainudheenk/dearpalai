/**
 * Vector Database Service (Placeholder)
 *
 * Phase 2: Will provide an abstraction layer over vector databases
 * (Pinecone, Weaviate, Qdrant, etc.) for storing and querying embeddings.
 */

import { logger } from '@utils/logger';

/** Interface for vector database operations */
export interface IVectorService {
  /** Store an embedding with associated metadata */
  upsert(id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void>;
  /** Query for similar embeddings */
  query(embedding: number[], topK: number): Promise<VectorQueryResult[]>;
  /** Delete an embedding by ID */
  delete(id: string): Promise<void>;
}

/** Result from a vector similarity query */
export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

/**
 * Mock vector service — returns empty results.
 * Replace with actual vector DB client in Phase 2.
 */
export class MockVectorService implements IVectorService {
  async upsert(id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void> {
    logger.info('[Mock] Vector upsert called', { id, dimensions: embedding.length, metadata });
  }

  async query(embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    logger.info('[Mock] Vector query called', { dimensions: embedding.length, topK });
    return [];
  }

  async delete(id: string): Promise<void> {
    logger.info('[Mock] Vector delete called', { id });
  }
}
