"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionEngineService = void 0;
const logger_1 = require("../../utils/logger");
class DecisionEngineService {
    constructor(chatService) {
        this.chatService = chatService;
    }
    /**
     * Makes a decision on how to respond to a message by invoking the configured IChatService.
     *
     * @param input - Aggregated pipeline outputs (transcript or text message)
     * @returns Decision result containing AI generated reply
     */
    async decide(input) {
        const userText = input.transcription?.text || input.message;
        logger_1.logger.info('DecisionEngine processing message with ChatService', {
            userTextLength: userText.length,
            hasTranscription: !!input.transcription,
        });
        try {
            const aiReply = await this.chatService.generateResponse(userText);
            return {
                reply: aiReply,
                confidence: 1.0,
                source: 'ai',
                shouldEscalate: false,
                reasoning: 'Generated response using configured IChatService completion API',
            };
        }
        catch (error) {
            logger_1.logger.error('DecisionEngine failed to get response from ChatService', {
                error: error.message,
            });
            throw error;
        }
    }
}
exports.DecisionEngineService = DecisionEngineService;
//# sourceMappingURL=decision-engine.service.js.map