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
  isStructuredCorpus?: boolean;
  topic?: string;
  audience?: string;
  escalate?: boolean;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSourceMetadata[];
  hasEscalationFlag?: boolean;
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
   * Prefers top 1-2 clinician-approved structured JSONL records when available, falling back seamlessly to legacy PDF chunks.
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

    // 2. Vector similarity search for matching chunks
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
        hasEscalationFlag: false,
      };
    }

    // 4. Check for structured JSONL corpus matches
    const structuredMatches = chunks.filter((c) => c.metadata?.is_structured_corpus === true);
    let context = '';
    let usedChunks: VectorSearchResult[] = [];
    let hasEscalationFlag = false;

    if (structuredMatches.length > 0) {
      // Select top 1-2 structured approved Q&A records for Sarvam delivery layer
      usedChunks = structuredMatches.slice(0, 2);
      logger.info(`Using top ${usedChunks.length} pre-structured JSONL corpus record(s) for RAG context`);

      context = usedChunks
        .map((c, i) => {
          const meta = c.metadata || {};
          if (meta.escalate === true || String(meta.escalate).toLowerCase() === 'true') {
            hasEscalationFlag = true;
          }
          return `[APPROVED RECORD ${i + 1}]
Topic: ${meta.topic || c.documentCategory || 'General'}
Audience: ${meta.audience || 'patient'}
Question (English): ${meta.q_en || ''}
Question (Malayalam): ${meta.q_ml || ''}
Clinician-Approved Malayalam Answer:
${meta.a_ml || c.chunkText}`;
        })
        .join('\n\n---\n\n');
    } else {
      // Legacy PDF Fallback Path with Adjacent Chunk Expansion
      logger.info('No structured corpus matches found; using legacy PDF chunks context');
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

      usedChunks = expandedChunks;
      context = this.contextBuilder.buildContext(expandedChunks);
    }

    const estimatedContextTokens = Math.ceil(context.length / 4);

    logger.info('RAG Context built', {
      isStructuredCorpus: structuredMatches.length > 0,
      numberOfChunks: usedChunks.length,
      totalContextChars: context.length,
      estimatedContextTokens,
      systemPromptLength: this.STRICT_SYSTEM_PROMPT.length,
      userQuestionLength: trimmedQuery.length,
      hasEscalationFlag,
    });

    // User prompt contains KNOWLEDGE CONTEXT + ORIGINAL PATIENT QUESTION (trimmedQuery)
    const userPrompt = `KNOWLEDGE CONTEXT:
${context}

USER QUESTION:
${trimmedQuery}`;

    // 5. Generate completion with Sarvam 105B (maxTokens: 3072, reasoningEffort: 'low')
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

    // 6. Sanitize WhatsApp formatting (remove accidental escaped backslashes)
    const sanitizedAnswer = answerText
      .replace(/\\([*_~`#\-+!])/g, '$1')
      .replace(/\r\n/g, '\n')
      .trim();

    // 7. Deduplicate sources metadata
    const sourceMap = new Map<string, RAGSourceMetadata>();
    chunks.forEach((c) => {
      if (!sourceMap.has(c.documentId)) {
        const meta = c.metadata || {};
        sourceMap.set(c.documentId, {
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          similarity: c.similarity,
          isStructuredCorpus: meta.is_structured_corpus === true,
          topic: (meta.topic as string) || c.documentCategory,
          audience: (meta.audience as string) || 'patient',
          escalate: meta.escalate === true,
        });
      }
    });

    return {
      answer: sanitizedAnswer,
      sources: Array.from(sourceMap.values()),
      hasEscalationFlag,
    };
  }
}
