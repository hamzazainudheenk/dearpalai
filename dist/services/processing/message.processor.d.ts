/**
 * Message Processor (Orchestrator)
 *
 * Routes incoming WhatsApp text/voice messages to the appropriate processor based on type.
 * Stores conversation records before and after processing, and syncs inbound/outbound messages to Supabase.
 *
 * Flow:
 *   Incoming webhook → parse → store metadata → route to processor → send reply → update metadata & Supabase
 */
import { ParsedMessage, ProcessingResult, IConversationStore, IMessageProcessor } from '../../types/index';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ITextToSpeechService } from '../ai/interfaces';
export declare class MessageProcessor {
    private readonly textProcessor;
    private readonly voiceProcessor;
    private readonly whatsAppService;
    private readonly conversationStore;
    private readonly ttsService?;
    constructor(textProcessor: IMessageProcessor, voiceProcessor: IMessageProcessor, whatsAppService: WhatsAppService, conversationStore: IConversationStore, ttsService?: ITextToSpeechService | undefined);
    /**
     * Syncs a message pair (inbound user message and outbound AI reply) to Supabase conversations table.
     */
    private syncToSupabase;
    /**
     * Processes an incoming message end-to-end.
     */
    processMessage(message: ParsedMessage): Promise<ProcessingResult>;
}
//# sourceMappingURL=message.processor.d.ts.map