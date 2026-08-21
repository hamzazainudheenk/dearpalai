"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = void 0;
// Services
const whatsapp_service_1 = require("./services/whatsapp/whatsapp.service");
const sarvam_speech_service_1 = require("./services/ai/sarvam-speech.service");
const sarvam_tts_service_1 = require("./services/ai/sarvam-tts.service");
const embedding_service_1 = require("./services/ai/embedding.service");
const rag_service_1 = require("./services/knowledge/rag.service");
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
    get speechService() {
        if (!this._speechService) {
            this._speechService = new sarvam_speech_service_1.SarvamSpeechService();
        }
        return this._speechService;
    }
    get ttsService() {
        if (!this._ttsService) {
            this._ttsService = new sarvam_tts_service_1.SarvamTextToSpeechService();
        }
        return this._ttsService;
    }
    get embeddingService() {
        if (!this._embeddingService) {
            this._embeddingService = new embedding_service_1.EmbeddingService();
        }
        return this._embeddingService;
    }
    /** Production Verified RAG Service */
    get ragService() {
        if (!this._ragService) {
            this._ragService = new rag_service_1.RAGService();
        }
        return this._ragService;
    }
    get riskAssessmentService() {
        if (!this._riskAssessmentService) {
            this._riskAssessmentService = new risk_assessment_service_1.RiskAssessmentService();
        }
        return this._riskAssessmentService;
    }
    get sarvamChatService() {
        if (!this._sarvamChatService) {
            this._sarvamChatService = new sarvam_chat_service_1.SarvamChatService();
        }
        return this._sarvamChatService;
    }
    get decisionEngine() {
        if (!this._decisionEngine) {
            this._decisionEngine = new decision_engine_service_1.DecisionEngineService(this.sarvamChatService);
        }
        return this._decisionEngine;
    }
    get aiPipeline() {
        if (!this._aiPipeline) {
            this._aiPipeline = new ai_pipeline_service_1.AIPipelineService(this.speechService, this.embeddingService, this.ragService, this.riskAssessmentService, this.decisionEngine);
        }
        return this._aiPipeline;
    }
    // ─── Store ────────────────────────────────────────────
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
exports.container = new Container();
//# sourceMappingURL=container.js.map