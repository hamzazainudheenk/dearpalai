"use strict";
/**
 * Text Message Processor
 *
 * Handles incoming text messages.
 * Phase 1: Returns a static acknowledgment from MessageTemplates.
 * Phase 2: Will route through the AI pipeline for intelligent responses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextProcessor = void 0;
const messages_1 = require("../../config/messages");
const logger_1 = require("../../utils/logger");
class TextProcessor {
    constructor(aiPipeline) {
        this.aiPipeline = aiPipeline;
    }
    /**
     * Processes a text message.
     *
     * @param message - Parsed incoming text message
     * @returns Processing result with reply
     */
    async process(message) {
        logger_1.logger.info('Processing text message', {
            messageId: message.messageId,
            phoneNumber: message.phoneNumber,
            textLength: message.textContent?.length || 0,
        });
        try {
            // Route through AI pipeline (returns static response in Phase 1)
            const pipelineResult = await this.aiPipeline.process({ message });
            return {
                success: true,
                reply: pipelineResult.reply || messages_1.MessageTemplates.TEXT_RECEIVED,
                source: pipelineResult.source,
                metadata: {
                    pipelineSuccess: pipelineResult.success,
                    decision: pipelineResult.decision,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Text processing failed', {
                messageId: message.messageId,
                error: error.message,
            });
            return {
                success: false,
                reply: messages_1.MessageTemplates.PROCESSING_ERROR,
                source: 'error',
                error: error.message,
            };
        }
    }
}
exports.TextProcessor = TextProcessor;
//# sourceMappingURL=text.processor.js.map