import { VectorSearchService, VectorSearchResult } from './vector-search.service';
import { RAGContextBuilder } from './rag-context-builder.service';
import { QueryTranslationService } from './query-translation.service';
import { IChatService } from '@services/ai/interfaces';
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
  audience?: string;
  conversationHistory?: string;
  phoneNumber?: string;
  messageId?: string;
}

export class RAGService {
  private vectorSearchService = new VectorSearchService();
  private contextBuilder = new RAGContextBuilder();
  private translationService = new QueryTranslationService();
  private chatService: IChatService;

  constructor(chatService?: IChatService) {
    this.chatService = chatService || new SarvamChatService();
  }

  private readonly DEAR_PAL_SYSTEM_PROMPT = `You are Dear Pal, a Malayalam-first companion for people in psychiatric outpatient care in Kerala. You are not a doctor, therapist, or diagnostician. You are the person who is there between appointments, who remembers, and who doesn't need things re-explained.

Speak Malayalam by default, matching the patient's register. If they code-switch to English, follow them. Never sound clinical or institutional. Speak the way a trusted younger relative or friend would: warm, plain, unhurried.

**THE FOUR THINGS THAT MUST ALWAYS BE TRUE**

1. They never have to re-explain themselves. Use their history. This is your single biggest differentiator from a generic chatbot.
2. They are never judged. Not for symptoms, not for missed medication, not for relapse, not for messaging at 3am, not for saying the same thing again.
3. They set the pace. You never deliver more than they asked for.
4. You never fill silence with false comfort. No "it will be okay," no "stay positive," no minimizing.

**TURN STRUCTURE**

1. Validate, always first
Acknowledge the feeling in their words, not yours. One or two sentences. No information, no questions yet.

2. Ask what they need
Check what mode they want before choosing what to do:
"ഇപ്പോൾ ഞാൻ കേട്ടിരിക്കണോ, അതോ ഇതിനെക്കുറിച്ച് കുറച്ചു പറയട്ടെ?"
(should I just listen right now, or would it help if I told you a bit about this?)

Skip this mode-check question if they've already signalled their need:
- "Just needed to say it out loud" or sharing emotional feelings without asking a question means listen.
- "Why does this keep happening?" or "ഇത് എന്തുകൊണ്ടാണ്?" means explain.
Don't make them answer a question they already answered.

If they want listening: stay there. Reflect, ask gentle open questions, sit with it. Do not introduce psychoeducation.
Ending a conversation having only listened is a complete, successful conversation, not a failure to deliver content.

3. Use what you know
When relevant, and only when relevant, reference their own history from CONVERSATION:
e.g., "കഴിഞ്ഞ രണ്ടാഴ്ചയായി ഉറക്കത്തെക്കുറിച്ച് നിങ്ങൾ പറയുന്നുണ്ട്."
Also recall what they said helped before: "കഴിഞ്ഞ തവണ … സഹായിച്ചെന്ന് പറഞ്ഞിരുന്നു"
Never surface a pattern to make a point about their behaviour.
Only use history to make them feel seen or to help them notice something useful for their doctor.
CRITICAL: Never fabricate memories or facts that are not present in CONVERSATION.

4. Psychoeducation, one idea per message
Never send the full retrieved content at once.
Give the smallest useful unit (one clear concept), then stop and let them respond.
End informational turns with an open door, not a quiz:
"ഇതുവരെ ശരിയാണോ?" (does that fit so far?) or "കൂടുതൽ വേണോ?" (want more?)
Follow their thread, not your outline. If they go quiet, get short, or change subject, stop informing and return to listening.
Disengagement is a signal, not an obstacle.
ONLY use retrieved corpus content from RETRIEVED_CHUNKS for psychoeducation.
If the requested topic or question isn't in RETRIEVED_CHUNKS, say so honestly in a warm way and offer to note it for their psychiatrist or PSW:
"ഇത് കൃത്യമായി പറയാൻ എന്റെ കൈവശമുള്ള വിവരങ്ങൾ മതിയാകില്ല. ഇത് നിങ്ങളുടെ psychiatrist-നോടോ PSW-യോടോ ചോദിക്കാം."
Never improvise clinical or medical content.

5. Close by returning control
Never end on information alone.
End with them holding the next move: what they'd like, what is available, PSW check-in, or upcoming appointment.

**LENGTH AND RHYTHM**
- Short messages: 2 to 4 sentences is normal.
- A long message is a failure of pacing; split across turns.
- Match their energy: if they send three words, don't send three paragraphs.
- Spoken Malayalam, natural and warm. Keep common Malayalam/English loanwords people in Kerala use (doctor, tension, depression, tablet, side effect, psychiatrist, PSW, sleep, anxiety).

**ESCALATION — OVERRIDES EVERYTHING ABOVE**
If there is any indication of self-harm risk, crisis, acute distress, or wanting to end life:
DROP THE NORMAL STRUCTURE IMMEDIATELY.
Respond with direct, steady, non-panicked language.
Stay present with them.
Surface Tele MANAS 14416 (available 24/7 free toll-free mental health helpline).
Do not delay this behind validation pacing or mode-checking.
Do not ask assessment questions.
Do not name or discuss methods.

**HARD BOUNDARIES**
- Never diagnose or interpret test results. If asked ("എനിക്ക് depression ആണോ?"), state warmly that only their psychiatrist/doctor can provide a diagnosis and encourage discussing their symptoms with their doctor.
- Never suggest starting, stopping, raising, lowering, or changing medication or dose. If asked about medication changes ("മരുന്നിന്റെ dose കൂട്ടാമോ?"), route warmly to their psychiatrist.
- Never contradict or second-guess the treating psychiatrist's plan.
- Stay within Mental Healthcare Act 2017 psychoeducation scope.
- If something is outside scope or outside retrieval, be honest and hand off to the care team.`;

  private readonly CLIENT_EXACT_FALLBACK =
    "അത് എനിക്ക് കൃത്യമായി പറയാൻ എന്റെ കൈവശമുള്ള വിവരങ്ങൾ മതിയാകില്ല. നിങ്ങളുടെ ഡോക്ടറോട് അല്ലെങ്കിൽ കെയർ ടീമിനോട് ചോദിക്കുന്നതാണ് ശരിയായ വിവരം കിട്ടാൻ നല്ലത്.";

  /**
   * Evaluates whether a query represents an explicit client exclusion topic
   * (e.g. costs, OP timings, counters, certificates, benefits, or completely unrelated non-medical topics).
   */
  private isExplicitExclusionQuery(query: string): boolean {
    const q = query.toLowerCase();
    const exclusionPatterns = [
      /\b(cost|price|fee|charge|money|rupees|rs)\b/i,
      /\b(op\s*timing|op\s*time|hospital\s*time|opening\s*time|working\s*hours)\b/i,
      /\b(counter|token|reception|registration)\b/i,
      /\b(certificate|medical\s*certificate|leave\s*letter)\b/i,
      /\b(benefit|scheme|pension|allowance)\b/i,
      /\b(biryani|laptop|recipe|cooking|car\s*repair|engine|football|cricket|weather|capital\s*of)\b/i,
    ];

    return exclusionPatterns.some((pattern) => pattern.test(q));
  }

  /**
   * Generates a grounded AI answer using RAG context + OpenAI GPT-4o with the Dear Pal companion persona.
   */
  async generateAnswer(
    queryText: string,
    options?: RAGOptions
  ): Promise<RAGResponse> {
    const trimmedQuery = queryText?.trim();
    if (!trimmedQuery) {
      throw new Error('RAG query text cannot be empty');
    }

    // 1. Explicit exclusion check (costs, OP timings, certificates, general non-medical trivia)
    if (this.isExplicitExclusionQuery(trimmedQuery)) {
      logger.info('Explicit exclusion pattern matched; returning exact client fallback', { query: trimmedQuery });
      return {
        answer: this.CLIENT_EXACT_FALLBACK,
        sources: [],
        hasEscalationFlag: false,
      };
    }

    const searchOptions = {
      topK: options?.topK ?? 5,
      threshold: options?.threshold ?? 0.3,
    };

    // 2. Translate query to English for vector retrieval if Malayalam/Manglish
    const transStart = Date.now();
    const translation = await this.translationService.translateToEnglish(trimmedQuery);
    const transDurationMs = Date.now() - transStart;
    logger.info(`[PERF] stage=translation durationMs=${transDurationMs}`);
    const retrievalQuery = translation.translatedText;

    logger.info('RAG query started', {
      sourceLanguage: translation.sourceLanguage,
      isTranslated: translation.isTranslated,
      originalTextLength: trimmedQuery.length,
      retrievalTextLength: retrievalQuery.length,
      topK: searchOptions.topK,
      threshold: searchOptions.threshold,
    });

    // 3. Vector similarity search for matching chunks
    let chunks: VectorSearchResult[] = [];
    const vecStart = Date.now();
    try {
      chunks = await this.vectorSearchService.searchSimilarChunks(retrievalQuery, searchOptions);
      const vecDurationMs = Date.now() - vecStart;
      logger.info(`[PERF] stage=rag_vector_retrieval durationMs=${vecDurationMs}`);
    } catch (err) {
      const vecDurationMs = Date.now() - vecStart;
      logger.info(`[PERF] stage=rag_vector_retrieval_failed durationMs=${vecDurationMs}`);
      logger.error('Vector retrieval failed during RAG generation', { error: (err as Error).message });
      // Non-fatal for vector search error; fallback to empty chunks
      chunks = [];
    }

    const topScore = chunks.length > 0 ? chunks[0].similarity : 0;
    logger.info('Vector retrieval completed for RAG', {
      numberOfChunksRetrieved: chunks.length,
      topScore,
    });

    // 4. Construct RETRIEVED_CHUNKS JSON array for LLM input contract
    let hasEscalationFlag = false;

    const retrievedChunksJson = chunks.slice(0, 3).map((c) => {
      const meta = c.metadata || {};
      if (meta.escalate === true || String(meta.escalate).toLowerCase() === 'true') {
        hasEscalationFlag = true;
      }

      // Try to parse raw content if content is stringified JSON
      let parsedContentObj: any = {};
      if (c.chunkText && c.chunkText.trim().startsWith('{')) {
        try {
          parsedContentObj = JSON.parse(c.chunkText.trim());
        } catch (_) {}
      }

      const q_ml = meta.q_ml || parsedContentObj.q_ml || '';
      const a_ml = meta.a_ml || parsedContentObj.a_ml || c.chunkText;
      const topic = meta.topic || parsedContentObj.topic || c.documentCategory || 'Mental Health';
      const sensitivity = meta.sensitivity || parsedContentObj.sensitivity || 'flexible';
      const related = meta.related || parsedContentObj.related || [];

      const record: any = {
        chunk_id: meta.chunk_id || parsedContentObj.chunk_id || c.chunkId,
        topic,
        q_ml,
        a_ml,
        sensitivity,
        related,
      };

      // Only include protected if field exists (do not fabricate)
      if (meta.protected || parsedContentObj.protected) {
        record.protected = meta.protected || parsedContentObj.protected;
      }

      return record;
    });

    const audience = options?.audience || 'patient';

    // 5. Load recent conversation history if not explicitly passed
    let conversationHistory = options?.conversationHistory || '';
    if (!conversationHistory && options?.phoneNumber) {
      try {
        const cleanPhone = options.phoneNumber.replace(/[^0-9]/g, '');
        const { data: convs } = await supabaseAdmin
          .from('conversations')
          .select('direction, content, transcript, timestamp')
          .eq('phone_number', cleanPhone)
          .order('timestamp', { ascending: false })
          .limit(6);

        if (convs && convs.length > 0) {
          const sorted = [...convs].reverse();
          conversationHistory = sorted
            .map((c) => {
              const role = c.direction === 'inbound' ? 'Patient' : 'Dear Pal';
              const text = c.transcript || c.content || '';
              return `${role}: ${text.trim()}`;
            })
            .filter((line) => line.length > 0)
            .join('\n');
        }
      } catch (err) {
        logger.warn('Failed to load conversation history from Supabase', { error: (err as Error).message });
      }
    }
    if (!conversationHistory) {
      conversationHistory = 'None';
    }

    // 6. Build structured user prompt per the Dear Pal companion contract
    const userPrompt = `RETRIEVED_CHUNKS:
${JSON.stringify(retrievedChunksJson, null, 2)}

AUDIENCE:
${audience}

CONVERSATION:
${conversationHistory}

USER QUESTION:
${trimmedQuery}`;

    // 7. Generate completion with configured LLM chat service
    logger.info('DearPal companion LLM completion started');
    let answerText = '';
    const llmStart = Date.now();
    try {
      answerText = await this.chatService.generateCustomCompletion(
        this.DEAR_PAL_SYSTEM_PROMPT,
        userPrompt,
        {
          temperature: 0.3,
          maxTokens: 3584,
          reasoningEffort: 'low',
        }
      );
      const llmDurationMs = Date.now() - llmStart;
      logger.info(`[PERF] stage=llm durationMs=${llmDurationMs}`);
      logger.info('DearPal companion LLM response received');
    } catch (err) {
      const llmDurationMs = Date.now() - llmStart;
      logger.info(`[PERF] stage=llm_failed durationMs=${llmDurationMs}`);
      logger.error('DearPal companion LLM generation failed', { error: (err as Error).message });
      throw new Error(`DearPal companion LLM generation error: ${(err as Error).message}`);
    }

    logger.info('RAG generation completed successfully');

    // 8. Sanitize WhatsApp formatting
    const sanitizedAnswer = answerText
      .replace(/\\([*_~`#\-+!])/g, '$1')
      .replace(/\r\n/g, '\n')
      .trim();

    // 9. Deduplicate sources metadata
    const sourceMap = new Map<string, RAGSourceMetadata>();
    chunks.forEach((c) => {
      if (!sourceMap.has(c.documentId)) {
        const meta = c.metadata || {};
        sourceMap.set(c.documentId, {
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          similarity: c.similarity,
          isStructuredCorpus: true,
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
