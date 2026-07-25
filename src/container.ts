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

import { IConversationStore } from '@app-types/index';

// Services
import { WhatsAppService } from '@services/whatsapp/whatsapp.service';
import {
  ISpeechService,
  IEmbeddingService,
  IRagService,
  IRiskAssessmentService,
  IDecisionEngine,
  IAIPipeline,
} from '@services/ai/interfaces';
import { SarvamSpeechService } from '@services/ai/sarvam-speech.service';
import { EmbeddingService } from '@services/ai/embedding.service';
import { RagService } from '@services/ai/rag.service';
import { RiskAssessmentService } from '@services/ai/risk-assessment.service';
import { DecisionEngineService } from '@services/ai/decision-engine.service';
import { SarvamChatService } from '@services/ai/sarvam-chat.service';
import { AIPipelineService } from '@services/ai/ai-pipeline.service';

// Processing
import { MessageProcessor } from '@services/processing/message.processor';
import { TextProcessor } from '@services/processing/text.processor';
import { VoiceProcessor } from '@services/processing/voice.processor';

// Store
import { MemoryConversationStore } from '@store/conversation.store';

// Controllers
import { WebhookController } from '@controllers/webhook.controller';

/**
 * Application service container.
 *
 * Provides lazy-initialized singleton instances of all services.
 * Change implementations here to swap mocks for real services.
 */
class Container {
  // ─── Cached Instances ─────────────────────────────────

  private _whatsAppService?: WhatsAppService;
  private _speechService?: ISpeechService;
  private _embeddingService?: IEmbeddingService;
  private _ragService?: IRagService;
  private _riskAssessmentService?: IRiskAssessmentService;
  private _sarvamChatService?: SarvamChatService;
  private _decisionEngine?: IDecisionEngine;
  private _aiPipeline?: IAIPipeline;
  private _conversationStore?: IConversationStore;
  private _textProcessor?: TextProcessor;
  private _voiceProcessor?: VoiceProcessor;
  private _messageProcessor?: MessageProcessor;
  private _webhookController?: WebhookController;

  // ─── WhatsApp ─────────────────────────────────────────

  get whatsAppService(): WhatsAppService {
    if (!this._whatsAppService) {
      this._whatsAppService = new WhatsAppService();
    }
    return this._whatsAppService;
  }

  // ─── AI Services ──────────────────────────────────────

  /** Speech-to-Text: Swap SarvamSpeechService for real implementation in Phase 2 */
  get speechService(): ISpeechService {
    if (!this._speechService) {
      this._speechService = new SarvamSpeechService();
    }
    return this._speechService;
  }

  /** Embedding: Swap EmbeddingService for real OpenAI implementation in Phase 2 */
  get embeddingService(): IEmbeddingService {
    if (!this._embeddingService) {
      this._embeddingService = new EmbeddingService();
    }
    return this._embeddingService;
  }

  /** RAG: Swap RagService for real vector DB implementation in Phase 2 */
  get ragService(): IRagService {
    if (!this._ragService) {
      this._ragService = new RagService();
    }
    return this._ragService;
  }

  /** Risk Assessment: Swap for real NLP-based implementation in Phase 2 */
  get riskAssessmentService(): IRiskAssessmentService {
    if (!this._riskAssessmentService) {
      this._riskAssessmentService = new RiskAssessmentService();
    }
    return this._riskAssessmentService;
  }

  /** Sarvam Chat Service */
  get sarvamChatService(): SarvamChatService {
    if (!this._sarvamChatService) {
      this._sarvamChatService = new SarvamChatService();
    }
    return this._sarvamChatService;
  }

  /** Decision Engine: Swapped for Sarvam AI LLM-based implementation */
  get decisionEngine(): IDecisionEngine {
    if (!this._decisionEngine) {
      this._decisionEngine = new DecisionEngineService(this.sarvamChatService);
    }
    return this._decisionEngine;
  }

  /** AI Pipeline: Orchestrates all AI services */
  get aiPipeline(): IAIPipeline {
    if (!this._aiPipeline) {
      this._aiPipeline = new AIPipelineService(
        this.speechService,
        this.embeddingService,
        this.ragService,
        this.riskAssessmentService,
        this.decisionEngine,
      );
    }
    return this._aiPipeline;
  }

  // ─── Store ────────────────────────────────────────────

  /** Conversation Store: Swap MemoryConversationStore for MongoConversationStore in Phase 2 */
  get conversationStore(): IConversationStore {
    if (!this._conversationStore) {
      this._conversationStore = new MemoryConversationStore();
    }
    return this._conversationStore;
  }

  // ─── Processors ───────────────────────────────────────

  get textProcessor(): TextProcessor {
    if (!this._textProcessor) {
      this._textProcessor = new TextProcessor(this.aiPipeline);
    }
    return this._textProcessor;
  }

  get voiceProcessor(): VoiceProcessor {
    if (!this._voiceProcessor) {
      this._voiceProcessor = new VoiceProcessor(this.whatsAppService, this.aiPipeline);
    }
    return this._voiceProcessor;
  }

  get messageProcessor(): MessageProcessor {
    if (!this._messageProcessor) {
      this._messageProcessor = new MessageProcessor(
        this.textProcessor,
        this.voiceProcessor,
        this.whatsAppService,
        this.conversationStore,
      );
    }
    return this._messageProcessor;
  }

  // ─── Controllers ──────────────────────────────────────

  get webhookController(): WebhookController {
    if (!this._webhookController) {
      this._webhookController = new WebhookController(
        this.whatsAppService,
        this.messageProcessor,
      );
    }
    return this._webhookController;
  }
}

/** Global application container — singleton */
export const container = new Container();
