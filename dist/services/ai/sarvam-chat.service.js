"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SarvamChatService = void 0;
const sarvamai_1 = require("sarvamai");
const logger_1 = require("../../utils/logger");
class SarvamChatService {
    constructor() {
        this.client = new sarvamai_1.SarvamAIClient({
            apiSubscriptionKey: process.env.SARVAM_API_KEY,
        });
        this.systemPrompt = `You are DearPal.

You are a compassionate emotional support companion.

Your purpose is to help people feel heard and supported.

Rules:

- Listen before giving advice.
- Validate emotions naturally.
- Reply in the user's language.
- Be warm, calm and human.
- Ask one thoughtful follow-up question when appropriate.
- Never diagnose medical or psychiatric conditions.
- Never claim to be a psychologist or psychiatrist.
- Encourage professional help when symptoms seem severe or persistent.
- If the user expresses suicidal thoughts or immediate danger, respond calmly, encourage contacting trusted people and local emergency services, and avoid giving unsafe advice.
- Keep responses short (2–6 sentences).
- Do not use robotic phrases.`;
    }
    async generateResponse(userMessage) {
        logger_1.logger.info('Calling Sarvam Chat Completion', {
            userMessageLength: userMessage.length,
        });
        const response = await this.client.chat.completions({
            model: 'sarvam-105b',
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
        logger_1.logger.info('Sarvam Chat Completion complete');
        const content = response.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response content received from Sarvam Chat API');
        }
        return content;
    }
    /**
     * Generates a grounded completion using Sarvam 105B with custom system prompt, user context, token limits,
     * reasoning effort controls, and safe single-retry handling if truncated (finishReason === "length").
     */
    async generateCustomCompletion(systemPrompt, userMessage, options) {
        const startTime = Date.now();
        const outerStartTime = options?.outerStartTime ?? startTime;
        const temperature = options?.temperature ?? 0.3;
        const maxTokens = options?.maxTokens ?? 3072;
        const reasoningEffort = options?.reasoningEffort ?? 'low';
        const isRetry = options?.isRetry ?? false;
        const attempt = isRetry ? 2 : 1;
        logger_1.logger.info('Calling Sarvam 105B Custom Completion', {
            userMessageLength: userMessage.length,
            temperature,
            maxTokens,
            reasoningEffort,
            isRetry,
            attempt,
        });
        // Append concise completion instruction on retry to prevent truncation
        const effectiveSystemPrompt = isRetry
            ? `${systemPrompt}\n\nIMPORTANT: Your previous output hit token limits. Be extremely concise. Limit response to 2-3 short bullet points. Conclude all sentences naturally.`
            : systemPrompt;
        const response = await this.client.chat.completions({
            model: 'sarvam-105b',
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
        const reasoningContent = choice?.message?.reasoning_content || '';
        logger_1.logger.info(`[LLM_PERF] attempt=${attempt} durationMs=${durationMs} finishReason=${finishReason} promptTokens=${promptTokens} completionTokens=${completionTokens} totalTokens=${totalTokens}`);
        logger_1.logger.info('Sarvam 105B Custom Completion complete', {
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
            logger_1.logger.warn('Sarvam 105B completion truncated due to token limit', {
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
                logger_1.logger.info('Attempting single retry for truncated Sarvam 105B response');
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
            throw new Error(`Empty response content received from Sarvam 105B API (finish_reason: ${finishReason})`);
        }
        const totalLlmDurationMs = Date.now() - outerStartTime;
        const totalAttempts = attempt;
        logger_1.logger.info(`[LLM_PERF] totalAttempts=${totalAttempts} totalLlmDurationMs=${totalLlmDurationMs}`);
        return content;
    }
}
exports.SarvamChatService = SarvamChatService;
//# sourceMappingURL=sarvam-chat.service.js.map