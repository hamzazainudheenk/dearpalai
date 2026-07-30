/**
 * Message Processor (Orchestrator)
 *
 * Routes incoming messages to the appropriate processor based on type.
 * Stores conversation metadata before and after processing, and syncs to Supabase.
 *
 * Flow:
 *   Incoming webhook → parse → store metadata → route to processor → send reply → update metadata & Supabase
 */
import { ParsedMessage, ProcessingResult, IConversationStore, IMessageProcessor } from '../../types/index';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
export declare class MessageProcessor {
    private readonly textProcessor;
    private readonly voiceProcessor;
    private readonly whatsAppService;
    private readonly conversationStore;
    constructor(textProcessor: IMessageProcessor, voiceProcessor: IMessageProcessor, whatsAppService: WhatsAppService, conversationStore: IConversationStore);
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