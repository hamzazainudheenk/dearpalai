"use strict";
/**
 * Vector Database Service (Placeholder)
 *
 * Phase 2: Will provide an abstraction layer over vector databases
 * (Pinecone, Weaviate, Qdrant, etc.) for storing and querying embeddings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockVectorService = void 0;
const logger_1 = require("../../utils/logger");
/**
 * Mock vector service — returns empty results.
 * Replace with actual vector DB client in Phase 2.
 */
class MockVectorService {
    async upsert(id, embedding, metadata) {
        logger_1.logger.info('[Mock] Vector upsert called', { id, dimensions: embedding.length, metadata });
    }
    async query(embedding, topK) {
        logger_1.logger.info('[Mock] Vector query called', { dimensions: embedding.length, topK });
        return [];
    }
    async delete(id) {
        logger_1.logger.info('[Mock] Vector delete called', { id });
    }
}
exports.MockVectorService = MockVectorService;
//# sourceMappingURL=vector.service.js.map