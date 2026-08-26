import { IConversationStore } from './types/index';
import { WhatsAppService } from './services/whatsapp/whatsapp.service';
import { ISpeechService, ITextToSpeechService, IEmbeddingService, IRiskAssessmentService, IDecisionEngine, IAIPipeline, IChatService } from './services/ai/interfaces';
import { RAGService } from './services/knowledge/rag.service';
import { SarvamChatService } from './services/ai/sarvam-chat.service';
import { MessageProcessor } from './services/processing/message.processor';
import { TextProcessor } from './services/processing/text.processor';
import { VoiceProcessor } from './services/processing/voice.processor';
import { WebhookController } from './controllers/webhook.controller';
import { ChatService } from './services/chat.service';
/**
 * Application service container.
 *
 * Provides lazy-initialized singleton instances of all services.
 */
declare class Container {
    private _whatsAppService?;
    private _speechService?;
    private _ttsService?;
    private _embeddingService?;
    private _ragService?;
    private _riskAssessmentService?;
    private _chatService?;
    private _sarvamChatService?;
    private _decisionEngine?;
    private _aiPipeline?;
    private _conversationStore?;
    private _textProcessor?;
    private _voiceProcessor?;
    private _messageProcessor?;
    private _webhookController?;
    private _chatBridgeService?;
    get whatsAppService(): WhatsAppService;
    get speechService(): ISpeechService;
    get ttsService(): ITextToSpeechService;
    get embeddingService(): IEmbeddingService;
    get chatService(): IChatService;
    /** Production Verified RAG Service */
    get ragService(): RAGService;
    get riskAssessmentService(): IRiskAssessmentService;
    get sarvamChatService(): SarvamChatService;
    get decisionEngine(): IDecisionEngine;
    get aiPipeline(): IAIPipeline;
    get conversationStore(): IConversationStore;
    get textProcessor(): TextProcessor;
    get voiceProcessor(): VoiceProcessor;
    get messageProcessor(): MessageProcessor;
    get webhookController(): WebhookController;
    /** Same RAGService (and therefore same GPT-4o + RAG + system prompt) and
     *  same Sarvam STT/TTS instances WhatsApp uses — no second AI stack.
     *  Named `chatBridgeService` (not `chatService`) to avoid colliding with
     *  the existing `chatService` getter above, which is the raw LLM chat
     *  client (OpenAI/Sarvam) the RAG pipeline itself calls. */
    get chatBridgeService(): ChatService;
}
export declare const container: Container;
export {};
//# sourceMappingURL=container.d.ts.map