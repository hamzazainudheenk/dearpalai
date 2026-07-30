/**
 * RAG Retrieval Service (Mock Implementation)
 *
 * Phase 1: Returns empty results.
 * Phase 2: Will query a vector database (Pinecone, Weaviate, etc.)
 *          to retrieve relevant healthcare knowledge documents.
 */
import { IRagService } from './interfaces';
import { RagResult } from '../../types/index';
export declare class RagService implements IRagService {
    /**
     * Queries the knowledge base with an embedding vector.
     *
     * @param embedding - Query embedding vector
     * @param context - Optional context for filtering
     * @returns Mock RAG result with no documents
     */
    query(embedding: number[], context?: string): Promise<RagResult>;
}
//# sourceMappingURL=rag.service.d.ts.map