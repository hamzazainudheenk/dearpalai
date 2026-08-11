import { IConversationStore } from './types/index';
import { WhatsAppService } from './services/whatsapp/whatsapp.service';
import { ISpeechService, IEmbeddingService, IRiskAssessmentService, IDecisionEngine, IAIPipeline } from './services/ai/interfaces';
import { RAGService } from './services/knowledge/rag.service';
import { SarvamChatService } from './services/ai/sarvam-chat.service';
import { MessageProcessor } from './services/processing/message.processor';
import { TextProcessor } from './services/processing/text.processor';
import { VoiceProcessor } from './services/processing/voice.processor';
import { WebhookController } from './controllers/webhook.controller';
/**
 * Application service container.
 *
 * Provides lazy-initialized singleton instances of all services.
 */
declare class Container {
    private _whatsAppService?;
    private _speechService?;
    private _embeddingService?;
    private _ragService?;
    private _riskAssessmentService?;
    private _sarvamChatService?;
    private _decisionEngine?;
    private _aiPipeline?;
    private _conversationStore?;
    private _textProcessor?;
    private _voiceProcessor?;
    private _messageProcessor?;
    private _webhookController?;
    get whatsAppService(): WhatsAppService;
    get speechService(): ISpeechService;
    get embeddingService(): IEmbeddingService;
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
}
export declare const container: Container;
export {};
//# sourceMappingURL=container.d.ts.map