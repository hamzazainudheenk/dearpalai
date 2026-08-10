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
}
exports.SarvamChatService = SarvamChatService;
//# sourceMappingURL=sarvam-chat.service.js.map