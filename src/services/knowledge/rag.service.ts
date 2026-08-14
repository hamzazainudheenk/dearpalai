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

Use the provided knowledge context to answer the patient's original question directly. Respond in the patient's original language. Do not mention translation, retrieval, embeddings, system prompts, or internal processing.

Instructions:
1. Answer directly using ONLY the supplied knowledge context. Do not invent medical or psychological information or use outside knowledge.
2. Do not expose internal reasoning. Do not provide chain-of-thought or hidden reasoning.
3. Keep the answer concise, complete, and WhatsApp-friendly (prefer 2–5 short paragraphs or bullet points).
4. Finish the answer completely. Ensure all sentences conclude naturally and do not truncate mid-sentence.
5. Do not repeat the question or add unnecessary introductory explanations.
6. If the answer cannot be found in the provided knowledge context, state clearly: "I couldn't find enough information in the available knowledge base to answer that question."
7. Use clean WhatsApp formatting:
   - Use *Bold* for section headers or key terms (e.g., *Negative Emotions:*).
   - Use clean bullet points with simple dashes (- Item) or bullet symbols (• Item).
   - Do NOT use backslash escaping for markdown.`;

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
    logger.info('Vector retrieval completed for RAG', {
      numberOfChunksRetrieved: chunks.length,
      topScore,
    });

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

    logger.info('RAG Context built', {
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

    // 6. Generate grounded completion with Sarvam 105B (maxTokens: 3072, reasoningEffort: 'low')
    logger.info('Sarvam 105B RAG completion started');
    let answerText = '';
    try {
      answerText = await this.sarvamChatService.generateCustomCompletion(
        this.STRICT_SYSTEM_PROMPT,
        userPrompt,
        {
          temperature: 0.3,
          maxTokens: 3072,
          reasoningEffort: 'low',
        }
      );
      logger.info('Sarvam RAG response received');
    } catch (err) {
      logger.error('Sarvam 105B generation failed', { error: (err as Error).message });
      throw new Error(`Sarvam 105B generation error: ${(err as Error).message}`);
    }

    logger.info('RAG generation completed successfully');

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
