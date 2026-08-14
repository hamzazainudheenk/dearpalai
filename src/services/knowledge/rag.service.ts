import { VectorSearchService, VectorSearchResult } from './vector-search.service';
import { RAGContextBuilder } from './rag-context-builder.service';
import { QueryTranslationService } from './query-translation.service';
import { SarvamChatService } from '@services/ai/sarvam-chat.service';
import { supabaseAdmin } from '@config/supabase';
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
  private translationService = new QueryTranslationService();
  private sarvamChatService = new SarvamChatService();

  private readonly STRICT_SYSTEM_PROMPT = `You are DearPal, a helpful and compassionate AI assistant.

Use the provided knowledge context to answer the patient's original question. Respond in the patient's original language. Do not mention translation, retrieval, embeddings, or internal systems.

Rules:
1. Answer strictly using only the retrieved approved knowledge. Do not invent information or use outside knowledge.
2. If the answer cannot be found in the provided knowledge context, clearly state: "I couldn't find enough information in the available knowledge base to answer that question."
3. Keep your response complete, concise, and WhatsApp-friendly (target ~500–900 characters when appropriate).
4. Use clean WhatsApp formatting:
   - Use *Bold* for section headers or key terms (e.g., *Negative Emotions:*).
   - Use clean bullet points with simple dashes (- Item) or bullet symbols (• Item).
   - Do NOT use backslash escaping for markdown (do not write \\* or \\_).
5. Avoid long introductions or repeating the user's question. Get straight to the helpful answer.
6. Ensure sentences are complete and conclude naturally. Do not truncate information.`;

  private readonly NO_KNOWLEDGE_FALLBACK =
    "I couldn't find enough information in the available knowledge base to answer that question.";

  /**
   * Generates a grounded AI answer using RAG context + Sarvam 105B generation.
   * Translates non-English queries to English for retrieval, while preserving original patient text for LLM generation.
   */
  async generateAnswer(queryText: string, options?: RAGOptions): Promise<RAGResponse> {
    const trimmedQuery = queryText?.trim();
    if (!trimmedQuery) {
      throw new Error('RAG query text cannot be empty');
    }

    const searchOptions = {
      topK: options?.topK ?? 5,
      threshold: options?.threshold,
    };

    // 1. Translate query to English for vector retrieval (if Malayalam or Mixed)
    const translation = await this.translationService.translateToEnglish(trimmedQuery);
    const retrievalQuery = translation.translatedText;

    logger.info('RAG query started', {
      sourceLanguage: translation.sourceLanguage,
      isTranslated: translation.isTranslated,
      originalTextLength: trimmedQuery.length,
      retrievalTextLength: retrievalQuery.length,
      translationDurationMs: translation.durationMs || 0,
      topK: searchOptions.topK,
      threshold: searchOptions.threshold,
    });

    // 2. Vector similarity search for top 3-5 matching chunks using retrievalQuery
    let chunks: VectorSearchResult[] = [];
    try {
      chunks = await this.vectorSearchService.searchSimilarChunks(retrievalQuery, searchOptions);
    } catch (err) {
      logger.error('Vector retrieval failed during RAG generation', { error: (err as Error).message });
      throw new Error(`Vector retrieval error: ${(err as Error).message}`);
    }

    const topScore = chunks.length > 0 ? chunks[0].similarity : 0;
    logger.info(`Number of chunks retrieved: ${chunks.length}`);
    logger.info(`Top similarity score: ${topScore}`);

    // 3. If no relevant chunks above threshold, DO NOT call Sarvam 105B
    if (chunks.length === 0) {
      logger.info('No relevant chunks found above similarity threshold; skipping Sarvam 105B call');
      return {
        answer: this.NO_KNOWLEDGE_FALLBACK,
        sources: [],
      };
    }

    // 4. Expand context by fetching adjacent trailing chunk if a retrieved chunk cut off mid-sentence
    const chunkKeys = new Set(chunks.map((c) => `${c.documentId}-${c.chunkNumber}`));
    const expandedChunks: VectorSearchResult[] = [...chunks];

    for (const chunk of chunks) {
      const text = chunk.chunkText.trim();
      const lastChar = text[text.length - 1];
      if (!['.', '!', '?', '"', "'", ')', ']'].includes(lastChar)) {
        const nextIndex = chunk.chunkNumber + 1;
        const key = `${chunk.documentId}-${nextIndex}`;
        if (!chunkKeys.has(key)) {
          const { data: nextChunk } = await supabaseAdmin
            .from('knowledge_chunks')
            .select('*')
            .eq('document_id', chunk.documentId)
            .eq('chunk_index', nextIndex)
            .maybeSingle();

          if (nextChunk) {
            chunkKeys.add(key);
            expandedChunks.push({
              chunkId: nextChunk.id,
              documentId: nextChunk.document_id,
              documentTitle: chunk.documentTitle,
              documentCategory: chunk.documentCategory,
              chunkNumber: nextChunk.chunk_index,
              chunkText: nextChunk.content,
              similarity: chunk.similarity * 0.99,
            });
          }
        }
      }
    }

    // 5. Build knowledge context block preserving chunk sequence
    const context = this.contextBuilder.buildContext(expandedChunks);
    const estimatedContextTokens = Math.ceil(context.length / 4);

    logger.info('Context built', {
      numberOfChunks: expandedChunks.length,
      totalContextChars: context.length,
      estimatedContextTokens,
      systemPromptLength: this.STRICT_SYSTEM_PROMPT.length,
      userQuestionLength: trimmedQuery.length,
    });

    // User prompt contains English KNOWLEDGE CONTEXT + ORIGINAL PATIENT QUESTION (trimmedQuery)
    const userPrompt = `KNOWLEDGE CONTEXT:
${context}

USER QUESTION:
${trimmedQuery}`;

    // 6. Generate grounded completion with Sarvam 105B (maxTokens: 2048)
    logger.info('Sarvam 105B request started');
    let answerText = '';
    try {
      answerText = await this.sarvamChatService.generateCustomCompletion(
        this.STRICT_SYSTEM_PROMPT,
        userPrompt,
        {
          temperature: 0.3,
          maxTokens: 2048,
        }
      );
      logger.info('Sarvam response received');
    } catch (err) {
      logger.error('Sarvam 105B generation failed', { error: (err as Error).message });
      throw new Error(`Sarvam 105B generation error: ${(err as Error).message}`);
    }

    logger.info('RAG generation completed');

    // 7. Sanitize WhatsApp formatting (remove accidental escaped backslashes)
    const sanitizedAnswer = answerText
      .replace(/\\([*_~`#\-+!])/g, '$1')
      .replace(/\r\n/g, '\n')
      .trim();

    // 8. Deduplicate sources metadata
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
      answer: sanitizedAnswer,
      sources: Array.from(sourceMap.values()),
    };
  }
}
