/**
 * Vector Database Service (Placeholder)
 *
 * Phase 2: Will provide an abstraction layer over vector databases
 * (Pinecone, Weaviate, Qdrant, etc.) for storing and querying embeddings.
 */
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
export declare class MockVectorService implements IVectorService {
    upsert(id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void>;
    query(embedding: number[], topK: number): Promise<VectorQueryResult[]>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=vector.service.d.ts.map