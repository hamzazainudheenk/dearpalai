import OpenAI from 'openai';
import { logger } from '@utils/logger';
import { aiConfig } from '@config/ai';
import { IChatService, CustomCompletionOptions } from './interfaces';

export class OpenAIChatService implements IChatService {
  private client: OpenAI | null = null;
  private readonly defaultModel = process.env.OPENAI_MODEL || aiConfig.openai.model || 'gpt-4o';

  private readonly defaultSystemPrompt = `You are Dear Pal, a Malayalam-first companion for people receiving psychiatric outpatient care in Kerala. You are not a doctor, therapist, or diagnostician. Your role is to support the person between appointments through listening, continuity, practical psychoeducation, and appropriate handoff to their care team.

Speak natural Kerala Malayalam by default. If the user mixes English, code-switch naturally. Never sound clinical or like a generic AI therapist. Avoid repetitive template phrases like "മനസ്സിലാക്കാം" or "ചിലപ്പോൾ".

**CORE PRINCIPLES**
1. Continuity: Remember what they told you without inventing memories.
2. No judgement: Never criticize symptoms, missed medication, relapse, or emotional reactions.
3. The user controls the pace: If they want to talk, listen. If they want an explanation, provide one idea at a time (2–4 short sentences). Do not force every conversation into psychoeducation or ask unnecessary mode questions.
4. Honest reassurance: No false comfort ("എല്ലാം ശരിയാകും", "പോസിറ്റീവ് ആയി ചിന്തിക്കൂ"). Distinguish observable facts from interpretations, especially with anxiety/OCD.

**CRISIS OVERRIDE**
If there is any indication of self-harm, suicide, or acute emergency: Drop normal structure, stay calm and present, and surface Tele-MANAS: 14416 immediately. Do not discuss methods.

**HARD BOUNDARIES**
- Never diagnose, confirm, or reject diagnoses, or interpret test results.
- Never advise starting, stopping, raising, lowering, or changing medication or dose (route warmly to their psychiatrist).
- Never contradict the treating clinician.`;

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.OPENAI_API_KEY || aiConfig.openai.apiKey;
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_openai_api_key_here')) {
      logger.error('OPENAI_API_KEY environment variable is missing or invalid');
      throw new Error('OPENAI_API_KEY environment variable is not configured. Cannot call OpenAI API.');
    }

    this.client = new OpenAI({ apiKey: apiKey.trim() });
    return this.client;
  }

  /**
   * Generates a standard completion using OpenAI GPT.
   */
  async generateResponse(userMessage: string): Promise<string> {
    return this.generateCustomCompletion(this.defaultSystemPrompt, userMessage);
  }

  /**
   * Generates a grounded completion using OpenAI GPT with custom system prompt, user context, token limits,
   * and single-retry handling if truncated (finishReason === "length").
   */
  async generateCustomCompletion(
    systemPrompt: string,
    userMessage: string,
    options?: CustomCompletionOptions
  ): Promise<string> {
    const startTime = Date.now();
    const outerStartTime = options?.outerStartTime ?? startTime;
    const temperature = options?.temperature ?? aiConfig.openai.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? aiConfig.openai.maxTokens ?? 3072;
    const isRetry = options?.isRetry ?? false;
    const attempt = isRetry ? 2 : 1;
    const model = process.env.OPENAI_MODEL || aiConfig.openai.model || 'gpt-4o';

    logger.info('Calling OpenAI Chat Completion', {
      provider: 'openai',
      model,
      userMessageLength: userMessage.length,
      temperature,
      maxTokens,
      isRetry,
      attempt,
    });

    const openai = this.getClient();

    // Append concise completion instruction on retry to prevent truncation
    const effectiveSystemPrompt = isRetry
      ? `${systemPrompt}\n\nIMPORTANT: Your previous output hit token limits. Be extremely concise. Use 2-3 short natural sentences. Conclude naturally.`
      : systemPrompt;

    try {
      const response = await openai.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content: effectiveSystemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      const durationMs = Date.now() - startTime;
      const choice = response.choices?.[0];
      const finishReason = choice?.finish_reason || 'unknown';
      const usage = response.usage;
      const promptTokens = usage?.prompt_tokens || 0;
      const completionTokens = usage?.completion_tokens || 0;
      const totalTokens = usage?.total_tokens || (promptTokens + completionTokens);
      const content = choice?.message?.content || '';

      logger.info(`[PERF] stage=llm provider=openai model=${model} durationMs=${durationMs}`);
      logger.info(`[LLM_PERF] attempt=${attempt} provider=openai model=${model} durationMs=${durationMs} finishReason=${finishReason} promptTokens=${promptTokens} completionTokens=${completionTokens} totalTokens=${totalTokens}`);

      // Check for truncated response
      if (finishReason === 'length') {
        logger.warn('OpenAI completion truncated due to max_tokens limit', {
          finishReason,
          promptTokens,
          completionTokens,
          responseLength: content.length,
          durationMs,
          isRetry,
        });

        if (!isRetry) {
          logger.info('Attempting single retry for truncated OpenAI response');
          return this.generateCustomCompletion(systemPrompt, userMessage, {
            ...options,
            isRetry: true,
            outerStartTime,
            maxTokens: Math.max(maxTokens, 3584),
          });
        }
      }

      if (!content || !content.trim()) {
        throw new Error(
          `Empty response content received from OpenAI API (model: ${model}, finish_reason: ${finishReason})`
        );
      }

      const totalLlmDurationMs = Date.now() - outerStartTime;
      logger.info(`[LLM_PERF] totalAttempts=${attempt} totalLlmDurationMs=${totalLlmDurationMs}`);

      return content;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.error('OpenAI Chat Completion failed', {
        provider: 'openai',
        model,
        durationMs,
        error: err?.message || 'OpenAI API error',
      });
      throw err;
    }
  }
}
