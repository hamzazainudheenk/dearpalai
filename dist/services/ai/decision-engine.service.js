"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionEngineService = void 0;
const logger_1 = require("../../utils/logger");
class DecisionEngineService {
    constructor(sarvamChatService) {
        this.sarvamChatService = sarvamChatService;
    }
    /**
     * Makes a decision on how to respond to a message by invoking SarvamChatService.
     *
     * @param input - Aggregated pipeline outputs (transcript or text message)
     * @returns Decision result containing Sarvam AI generated reply
     */
    async decide(input) {
        const userText = input.transcription?.text || input.message;
        logger_1.logger.info('DecisionEngine processing message with SarvamChatService', {
            userTextLength: userText.length,
            hasTranscription: !!input.transcription,
        });
        try {
            const aiReply = await this.sarvamChatService.generateResponse(userText);
            return {
                reply: aiReply,
                confidence: 1.0,
                source: 'ai',
                shouldEscalate: false,
                reasoning: 'Generated response using Sarvam Chat completion API (sarvam-30b)',
            };
        }
        catch (error) {
            logger_1.logger.error('DecisionEngine failed to get response from SarvamChatService', {
                error: error.message,
            });
            throw error;
        }
    }
}
exports.DecisionEngineService = DecisionEngineService;
//# sourceMappingURL=decision-engine.service.js.map