import { IConversationStore } from '@app-types/index';

// Services
import { WhatsAppService } from '@services/whatsapp/whatsapp.service';
import {
  ISpeechService,
  ITextToSpeechService,
  IEmbeddingService,
  IRiskAssessmentService,
  IDecisionEngine,
  IAIPipeline,
} from '@services/ai/interfaces';
import { SarvamSpeechService } from '@services/ai/sarvam-speech.service';
import { SarvamTextToSpeechService } from '@services/ai/sarvam-tts.service';
import { EmbeddingService } from '@services/ai/embedding.service';
import { RAGService } from '@services/knowledge/rag.service';
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
 */
class Container {
  // ─── Cached Instances ─────────────────────────────────

  private _whatsAppService?: WhatsAppService;
  private _speechService?: ISpeechService;
  private _ttsService?: ITextToSpeechService;
  private _embeddingService?: IEmbeddingService;
  private _ragService?: RAGService;
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

  get speechService(): ISpeechService {
    if (!this._speechService) {
      this._speechService = new SarvamSpeechService();
    }
    return this._speechService;
  }

  get ttsService(): ITextToSpeechService {
    if (!this._ttsService) {
      this._ttsService = new SarvamTextToSpeechService();
    }
    return this._ttsService;
  }

  get embeddingService(): IEmbeddingService {
    if (!this._embeddingService) {
      this._embeddingService = new EmbeddingService();
    }
    return this._embeddingService;
  }

  /** Production Verified RAG Service */
  get ragService(): RAGService {
    if (!this._ragService) {
      this._ragService = new RAGService();
    }
    return this._ragService;
  }

  get riskAssessmentService(): IRiskAssessmentService {
    if (!this._riskAssessmentService) {
      this._riskAssessmentService = new RiskAssessmentService();
    }
    return this._riskAssessmentService;
  }

  get sarvamChatService(): SarvamChatService {
    if (!this._sarvamChatService) {
      this._sarvamChatService = new SarvamChatService();
    }
    return this._sarvamChatService;
  }

  get decisionEngine(): IDecisionEngine {
    if (!this._decisionEngine) {
      this._decisionEngine = new DecisionEngineService(this.sarvamChatService);
    }
    return this._decisionEngine;
  }

  get aiPipeline(): IAIPipeline {
    if (!this._aiPipeline) {
      this._aiPipeline = new AIPipelineService(
        this.speechService,
        this.embeddingService,
        this.ragService,
        this.riskAssessmentService,
        this.decisionEngine
      );
    }
    return this._aiPipeline;
  }

  // ─── Store ────────────────────────────────────────────

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
        this.conversationStore
      );
    }
    return this._messageProcessor;
  }

  // ─── Controllers ──────────────────────────────────────

  get webhookController(): WebhookController {
    if (!this._webhookController) {
      this._webhookController = new WebhookController(
        this.whatsAppService,
        this.messageProcessor
      );
    }
    return this._webhookController;
  }
}

export const container = new Container();
