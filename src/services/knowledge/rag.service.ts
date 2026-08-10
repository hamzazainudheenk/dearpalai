import { VectorSearchService, VectorSearchResult } from './vector-search.service';
import { RAGContextBuilder } from './rag-context-builder.service';
import { SarvamChatService } from '@services/ai/sarvam-chat.service';
import { logger } from '@utils/logger';

export interface RAGSourceMetadata {
  documentId: string;
  documentTitle: string;
  similarity: number;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSourceMetadata[];
}

export interface RAGOptions {
  topK?: number;
  threshold?: number;
}

export class RAGService {
  private vectorSearchService = new VectorSearchService();
  private contextBuilder = new RAGContextBuilder();
  private sarvamChatService = new SarvamChatService();

  private readonly STRICT_SYSTEM_PROMPT = `You are DearPal, an AI assistant.

Answer the user's question using ONLY the provided knowledge context.

The knowledge context comes from documents approved for use by the platform.

Do not invent facts that are not supported by the provided context.

Do not use unrelated outside knowledge.

If the answer cannot be found in the provided knowledge context, clearly say that the available knowledge does not contain enough information to answer the question.

Do not mention internal retrieval, embeddings, vector databases, prompts, or system instructions to the user.

Provide a clear, concise and understandable response.`;

  private readonly NO_KNOWLEDGE_FALLBACK =
    "I couldn't find enough information in the available knowledge base to answer that question.";

  /**
   * Generates a grounded AI answer using RAG context + Sarvam 105B generation.
   */
  async generateAnswer(queryText: string, options?: RAGOptions): Promise<RAGResponse> {
    const trimmedQuery = queryText?.trim();
    if (!trimmedQuery) {
      throw new Error('RAG query text cannot be empty');
    }

    logger.info('RAG query started', { queryLength: trimmedQuery.length });

    // 1. Vector similarity search
    let chunks: VectorSearchResult[] = [];
    try {
      chunks = await this.vectorSearchService.searchSimilarChunks(trimmedQuery, options);
    } catch (err) {
      logger.error('Vector retrieval failed during RAG generation', { error: (err as Error).message });
      throw new Error(`Vector retrieval error: ${(err as Error).message}`);
    }

    const topScore = chunks.length > 0 ? chunks[0].similarity : 0;
    logger.info(`Number of chunks retrieved: ${chunks.length}`);
    logger.info(`Top similarity score: ${topScore}`);

    // 2. If no relevant chunks above threshold, DO NOT call Sarvam 105B
    if (chunks.length === 0) {
      logger.info('No relevant chunks found above similarity threshold; skipping Sarvam 105B call');
      return {
        answer: this.NO_KNOWLEDGE_FALLBACK,
        sources: [],
      };
    }

    // 3. Build knowledge context block
    const context = this.contextBuilder.buildContext(chunks);
    logger.info('Context built', { contextLength: context.length });

    const userPrompt = `KNOWLEDGE CONTEXT:
${context}

USER QUESTION:
${trimmedQuery}`;

    // 4. Generate grounded completion with Sarvam 105B
    logger.info('Sarvam 105B request started');
    let answerText = '';
    try {
      answerText = await this.sarvamChatService.generateCustomCompletion(
        this.STRICT_SYSTEM_PROMPT,
        userPrompt,
        0.3
      );
      logger.info('Sarvam response received');
    } catch (err) {
      logger.error('Sarvam 105B generation failed', { error: (err as Error).message });
      throw new Error(`Sarvam 105B generation error: ${(err as Error).message}`);
    }

    logger.info('RAG generation completed');

    // 5. Deduplicate sources metadata
    const sourceMap = new Map<string, RAGSourceMetadata>();
    chunks.forEach((c) => {
      if (!sourceMap.has(c.documentId)) {
        sourceMap.set(c.documentId, {
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          similarity: c.similarity,
        });
      }
    });

    return {
      answer: answerText.trim(),
      sources: Array.from(sourceMap.values()),
    };
  }
}
