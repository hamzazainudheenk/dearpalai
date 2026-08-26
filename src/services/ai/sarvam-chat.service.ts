import { SarvamAIClient } from 'sarvamai';
import { logger } from '@utils/logger';
import { IChatService, CustomCompletionOptions } from './interfaces';

export interface SarvamCustomCompletionOptions extends CustomCompletionOptions {}

export class SarvamChatService implements IChatService {
  private client = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY!,
  });

  private readonly systemPrompt = `You are Dear Pal, a Malayalam-first companion for people receiving psychiatric outpatient care in Kerala. You are not a doctor, therapist, or diagnostician. Your role is to support the person between appointments through listening, continuity, practical psychoeducation, and appropriate handoff to their care team.

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

  async generateResponse(userMessage: string): Promise<string> {
    logger.info('Calling Sarvam Chat Completion', {
      userMessageLength: userMessage.length,
    });

    const response = await this.client.chat.completions({
      model: 'sarvam-105b-conversations' as any,
      temperature: 0.7,
      max_tokens: 3072,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    logger.info('Sarvam Chat Completion complete');

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response content received from Sarvam Chat API');
    }

    return content;
  }

  /**
   * Generates a grounded completion using sarvam-105b-conversations with custom system prompt, user context, token limits,
   * reasoning effort controls, and safe single-retry handling if truncated (finishReason === "length").
   */
  async generateCustomCompletion(
    systemPrompt: string,
    userMessage: string,
    options?: SarvamCustomCompletionOptions
  ): Promise<string> {
    const startTime = Date.now();
    const outerStartTime = options?.outerStartTime ?? startTime;
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 3072;
    const reasoningEffort = options?.reasoningEffort ?? 'low';
    const isRetry = options?.isRetry ?? false;
    const attempt = isRetry ? 2 : 1;

    logger.info('Calling sarvam-105b-conversations Custom Completion', {
      userMessageLength: userMessage.length,
      temperature,
      maxTokens,
      reasoningEffort,
      isRetry,
      attempt,
    });

    // Append concise completion instruction on retry to prevent truncation
    const effectiveSystemPrompt = isRetry
      ? `${systemPrompt}\n\nIMPORTANT: Your previous output hit token limits. Be extremely concise. Use 2-3 short natural sentences. Conclude naturally.`
      : systemPrompt;

    const response = await this.client.chat.completions({
      model: 'sarvam-105b-conversations' as any,
      temperature,
      max_tokens: maxTokens,
      reasoning_effort: reasoningEffort,
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
    const reasoningContent = (choice?.message as any)?.reasoning_content || '';

    logger.info(`[LLM_PERF] attempt=${attempt} durationMs=${durationMs} finishReason=${finishReason} promptTokens=${promptTokens} completionTokens=${completionTokens} totalTokens=${totalTokens}`);

    logger.info('sarvam-105b-conversations Custom Completion complete', {
      finishReason,
      promptTokens,
      completionTokens,
      responseLength: content.length,
      reasoningLength: reasoningContent.length,
      durationMs,
      isRetry,
    });

    // Check for truncated response (finishReason === 'length')
    if (finishReason === 'length') {
      logger.warn('sarvam-105b-conversations completion truncated due to token limit', {
        finishReason,
        promptTokens,
        completionTokens,
        responseLength: content.length,
        reasoningLength: reasoningContent.length,
        durationMs,
        isRetry,
      });

      // If this is the initial request, attempt exactly 1 retry with concise parameters
      if (!isRetry) {
        logger.info('Attempting single retry for truncated sarvam-105b-conversations response');
        return this.generateCustomCompletion(systemPrompt, userMessage, {
          ...options,
          isRetry: true,
          outerStartTime,
          maxTokens: Math.max(maxTokens, 3584),
          reasoningEffort: 'low',
        });
      }
    }

    if (!content || !content.trim()) {
      throw new Error(
        `Empty response content received from sarvam-105b-conversations API (finish_reason: ${finishReason})`
      );
    }

    const totalLlmDurationMs = Date.now() - outerStartTime;
    const totalAttempts = attempt;
    logger.info(`[LLM_PERF] totalAttempts=${totalAttempts} totalLlmDurationMs=${totalLlmDurationMs}`);

    return content;
  }
}
