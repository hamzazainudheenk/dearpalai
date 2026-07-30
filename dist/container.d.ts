/**
 * Dependency Injection Container
 *
 * Simple service-container pattern that wires up all services
 * with their dependencies. This avoids the complexity of decorator-based
 * DI libraries while still providing clean dependency management.
 *
 * To swap a mock service for a real implementation:
 * 1. Create the real implementation (e.g., RealSarvamSpeechService)
 * 2. Update the corresponding getter in this container
 * 3. No changes needed in processors, controllers, or routes
 *
 * All services are lazily instantiated (created on first access)
 * and cached as singletons for the lifetime of the application.
 */
import { IConversationStore } from './types/index';
import { WhatsAppService } from './services/whatsapp/whatsapp.service';
import { ISpeechService, IEmbeddingService, IRagService, IRiskAssessmentService, IDecisionEngine, IAIPipeline } from './services/ai/interfaces';
import { SarvamChatService } from './services/ai/sarvam-chat.service';
import { MessageProcessor } from './services/processing/message.processor';
import { TextProcessor } from './services/processing/text.processor';
import { VoiceProcessor } from './services/processing/voice.processor';
import { WebhookController } from './controllers/webhook.controller';
/**
 * Application service container.
 *
 * Provides lazy-initialized singleton instances of all services.
 * Change implementations here to swap mocks for real services.
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
    /** Speech-to-Text: Swap SarvamSpeechService for real implementation in Phase 2 */
    get speechService(): ISpeechService;
    /** Embedding: Swap EmbeddingService for real OpenAI implementation in Phase 2 */
    get embeddingService(): IEmbeddingService;
    /** RAG: Swap RagService for real vector DB implementation in Phase 2 */
    get ragService(): IRagService;
    /** Risk Assessment: Swap for real NLP-based implementation in Phase 2 */
    get riskAssessmentService(): IRiskAssessmentService;
    /** Sarvam Chat Service */
    get sarvamChatService(): SarvamChatService;
    /** Decision Engine: Swapped for Sarvam AI LLM-based implementation */
    get decisionEngine(): IDecisionEngine;
    /** AI Pipeline: Orchestrates all AI services */
    get aiPipeline(): IAIPipeline;
    /** Conversation Store: Swap MemoryConversationStore for MongoConversationStore in Phase 2 */
    get conversationStore(): IConversationStore;
    get textProcessor(): TextProcessor;
    get voiceProcessor(): VoiceProcessor;
    get messageProcessor(): MessageProcessor;
    get webhookController(): WebhookController;
}
/** Global application container — singleton */
export declare const container: Container;
export {};
//# sourceMappingURL=container.d.ts.map