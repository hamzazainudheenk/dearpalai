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
            max_tokens: 2048,
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
     * Generates a grounded completion using Sarvam 105B with a custom system prompt, user context, and token limits.
     */
    async generateCustomCompletion(systemPrompt, userMessage, options) {
        const temperature = options?.temperature ?? 0.3;
        const maxTokens = options?.maxTokens ?? 2048;
        logger_1.logger.info('Calling Sarvam 105B Custom Completion', {
            userMessageLength: userMessage.length,
            temperature,
            maxTokens,
        });
        const response = await this.client.chat.completions({
            model: 'sarvam-105b',
            temperature,
            max_tokens: maxTokens,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: userMessage,
                },
            ],
        });
        const choice = response.choices?.[0];
        const finishReason = choice?.finish_reason;
        const usage = response.usage;
        const content = choice?.message?.content;
        const reasoningContent = choice?.message?.reasoning_content;
        logger_1.logger.info('Sarvam 105B Custom Completion complete', {
            finishReason,
            promptTokens: usage?.prompt_tokens,
            completionTokens: usage?.completion_tokens,
            responseLength: content?.length || 0,
            reasoningLength: reasoningContent?.length || 0,
        });
        if (!content || !content.trim()) {
            throw new Error(`Empty response content received from Sarvam 105B API (finish_reason: ${finishReason || 'unknown'})`);
        }
        return content;
    }
}
exports.SarvamChatService = SarvamChatService;
//# sourceMappingURL=sarvam-chat.service.js.map