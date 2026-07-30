"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = void 0;
// Services
const whatsapp_service_1 = require("./services/whatsapp/whatsapp.service");
const sarvam_speech_service_1 = require("./services/ai/sarvam-speech.service");
const embedding_service_1 = require("./services/ai/embedding.service");
const rag_service_1 = require("./services/ai/rag.service");
const risk_assessment_service_1 = require("./services/ai/risk-assessment.service");
const decision_engine_service_1 = require("./services/ai/decision-engine.service");
const sarvam_chat_service_1 = require("./services/ai/sarvam-chat.service");
const ai_pipeline_service_1 = require("./services/ai/ai-pipeline.service");
// Processing
const message_processor_1 = require("./services/processing/message.processor");
const text_processor_1 = require("./services/processing/text.processor");
const voice_processor_1 = require("./services/processing/voice.processor");
// Store
const conversation_store_1 = require("./store/conversation.store");
// Controllers
const webhook_controller_1 = require("./controllers/webhook.controller");
/**
 * Application service container.
 *
 * Provides lazy-initialized singleton instances of all services.
 * Change implementations here to swap mocks for real services.
 */
class Container {
    // ─── WhatsApp ─────────────────────────────────────────
    get whatsAppService() {
        if (!this._whatsAppService) {
            this._whatsAppService = new whatsapp_service_1.WhatsAppService();
        }
        return this._whatsAppService;
    }
    // ─── AI Services ──────────────────────────────────────
    /** Speech-to-Text: Swap SarvamSpeechService for real implementation in Phase 2 */
    get speechService() {
        if (!this._speechService) {
            this._speechService = new sarvam_speech_service_1.SarvamSpeechService();
        }
        return this._speechService;
    }
    /** Embedding: Swap EmbeddingService for real OpenAI implementation in Phase 2 */
    get embeddingService() {
        if (!this._embeddingService) {
            this._embeddingService = new embedding_service_1.EmbeddingService();
        }
        return this._embeddingService;
    }
    /** RAG: Swap RagService for real vector DB implementation in Phase 2 */
    get ragService() {
        if (!this._ragService) {
            this._ragService = new rag_service_1.RagService();
        }
        return this._ragService;
    }
    /** Risk Assessment: Swap for real NLP-based implementation in Phase 2 */
    get riskAssessmentService() {
        if (!this._riskAssessmentService) {
            this._riskAssessmentService = new risk_assessment_service_1.RiskAssessmentService();
        }
        return this._riskAssessmentService;
    }
    /** Sarvam Chat Service */
    get sarvamChatService() {
        if (!this._sarvamChatService) {
            this._sarvamChatService = new sarvam_chat_service_1.SarvamChatService();
        }
        return this._sarvamChatService;
    }
    /** Decision Engine: Swapped for Sarvam AI LLM-based implementation */
    get decisionEngine() {
        if (!this._decisionEngine) {
            this._decisionEngine = new decision_engine_service_1.DecisionEngineService(this.sarvamChatService);
        }
        return this._decisionEngine;
    }
    /** AI Pipeline: Orchestrates all AI services */
    get aiPipeline() {
        if (!this._aiPipeline) {
            this._aiPipeline = new ai_pipeline_service_1.AIPipelineService(this.speechService, this.embeddingService, this.ragService, this.riskAssessmentService, this.decisionEngine);
        }
        return this._aiPipeline;
    }
    // ─── Store ────────────────────────────────────────────
    /** Conversation Store: Swap MemoryConversationStore for MongoConversationStore in Phase 2 */
    get conversationStore() {
        if (!this._conversationStore) {
            this._conversationStore = new conversation_store_1.MemoryConversationStore();
        }
        return this._conversationStore;
    }
    // ─── Processors ───────────────────────────────────────
    get textProcessor() {
        if (!this._textProcessor) {
            this._textProcessor = new text_processor_1.TextProcessor(this.aiPipeline);
        }
        return this._textProcessor;
    }
    get voiceProcessor() {
        if (!this._voiceProcessor) {
            this._voiceProcessor = new voice_processor_1.VoiceProcessor(this.whatsAppService, this.aiPipeline);
        }
        return this._voiceProcessor;
    }
    get messageProcessor() {
        if (!this._messageProcessor) {
            this._messageProcessor = new message_processor_1.MessageProcessor(this.textProcessor, this.voiceProcessor, this.whatsAppService, this.conversationStore);
        }
        return this._messageProcessor;
    }
    // ─── Controllers ──────────────────────────────────────
    get webhookController() {
        if (!this._webhookController) {
            this._webhookController = new webhook_controller_1.WebhookController(this.whatsAppService, this.messageProcessor);
        }
        return this._webhookController;
    }
}
/** Global application container — singleton */
exports.container = new Container();
//# sourceMappingURL=container.js.map