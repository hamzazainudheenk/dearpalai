"use strict";
/**
 * Embedding Service (Mock Implementation)
 *
 * Phase 1: Returns a zero vector.
 * Phase 2: Will integrate with OpenAI or other embedding providers
 *          to generate text embeddings for RAG retrieval.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const ai_1 = require("../../config/ai");
const logger_1 = require("../../utils/logger");
class EmbeddingService {
    /**
     * Generates an embedding vector from text.
     *
     * @param text - Input text to embed
     * @returns Mock embedding result with zero vector
     */
    async generateEmbedding(text) {
        logger_1.logger.info('[Mock] Embedding service called', {
            textLength: text.length,
            provider: ai_1.aiConfig.embedding.provider,
        });
        // Phase 2: Replace with actual embedding API call
        // const response = await openai.embeddings.create({ input: text, model: aiConfig.embedding.model });
        return {
            embedding: new Array(ai_1.aiConfig.embedding.dimensions).fill(0),
            model: ai_1.aiConfig.embedding.model,
            tokenCount: 0,
        };
    }
}
exports.EmbeddingService = EmbeddingService;
//# sourceMappingURL=embedding.service.js.map