/**
 * Text Message Processor
 *
 * Handles incoming text messages.
 * Phase 1: Returns a static acknowledgment from MessageTemplates.
 * Phase 2: Will route through the AI pipeline for intelligent responses.
 */
import { IMessageProcessor, ParsedMessage, ProcessingResult } from '../../types/index';
import { IAIPipeline } from '../ai/interfaces';
export declare class TextProcessor implements IMessageProcessor {
    private readonly aiPipeline;
    constructor(aiPipeline: IAIPipeline);
    /**
     * Processes a text message.
     *
     * @param message - Parsed incoming text message
     * @returns Processing result with reply
     */
    process(message: ParsedMessage): Promise<ProcessingResult>;
}
//# sourceMappingURL=text.processor.d.ts.map