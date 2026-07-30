/**
 * Voice Message Processor
 *
 * Handles incoming audio/voice messages.
 * Phase 1: Downloads audio file, returns static acknowledgment.
 * Phase 2: Downloads audio → STT (Sarvam) → AI pipeline → dynamic response.
 */
import { IMessageProcessor, ParsedMessage, ProcessingResult } from '../../types/index';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { IAIPipeline } from '../ai/interfaces';
export declare class VoiceProcessor implements IMessageProcessor {
    private readonly whatsAppService;
    private readonly aiPipeline;
    constructor(whatsAppService: WhatsAppService, aiPipeline: IAIPipeline);
    /**
     * Processes a voice message.
     *
     * Steps:
     * 1. Download audio file from WhatsApp
     * 2. Route through AI pipeline (STT → Embedding → RAG → Decision)
     * 3. Return processing result with reply
     *
     * @param message - Parsed incoming voice message
     * @returns Processing result with reply and audio file path
     */
    process(message: ParsedMessage): Promise<ProcessingResult>;
}
//# sourceMappingURL=voice.processor.d.ts.map