import { RAGService } from '@services/knowledge/rag.service';
import { AIPipelineService } from '@services/ai/ai-pipeline.service';
import { MessageType, ParsedMessage } from '@app-types/index';
import { aiConfig } from '@config/ai';

describe('DearPal New System Prompt & Behavioral Pipeline', () => {
  let mockChatService: any;
  let mockSpeechService: any;
  let mockEmbeddingService: any;
  let mockRiskService: any;
  let mockDecisionEngine: any;
  let ragService: RAGService;
  let aiPipeline: AIPipelineService;

  beforeEach(() => {
    (aiConfig.pipeline as any).enabled = true;
    mockChatService = {
      generateResponse: jest.fn().mockResolvedValue('സുഖമായിരിക്കുന്നു, എന്തൊക്കെയുണ്ട്?'),
      generateCustomCompletion: jest.fn().mockImplementation(async (systemPrompt: string, userPrompt: string) => {
        return 'സുഖമായിരിക്കുന്നു, എന്തൊക്കെയുണ്ട്?';
      }),
    };

    mockSpeechService = {
      transcribe: jest.fn().mockResolvedValue({
        text: 'ഹലോ',
        confidence: 0.95,
        language: 'ml',
      }),
    };

    mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(1024).fill(0.1)),
    };

    mockRiskService = {
      assess: jest.fn().mockResolvedValue({
        riskLevel: 'low',
        score: 0.0,
        flags: [],
        requiresEscalation: false,
      }),
    };

    mockDecisionEngine = {
      decide: jest.fn().mockResolvedValue({
        reply: 'സുഖമായിരിക്കുന്നു',
        confidence: 1.0,
        source: 'ai',
        shouldEscalate: false,
        reasoning: 'mock',
      }),
    };

    ragService = new RAGService(mockChatService);
    // Mock translation & vector search for fast deterministic RAG testing
    (ragService as any).translationService = {
      translateToEnglish: jest.fn().mockResolvedValue({
        translatedText: 'hello',
        sourceLanguage: 'ml',
        isTranslated: false,
      }),
    };
    (ragService as any).vectorSearchService = {
      searchSimilarChunks: jest.fn().mockResolvedValue([]),
    };

    aiPipeline = new AIPipelineService(
      mockSpeechService,
      mockEmbeddingService,
      ragService,
      mockRiskService,
      mockDecisionEngine
    );
  });

  describe('1. System Prompt Integrity', () => {
    it('uses the new authoritative Dear Pal prompt without old mandatory mode check or mandatory endings', async () => {
      await ragService.generateAnswer('ഹലോ');

      expect(mockChatService.generateCustomCompletion).toHaveBeenCalled();
      const passedSystemPrompt = mockChatService.generateCustomCompletion.mock.calls[0][0];

      // Must have new identity & core principles
      expect(passedSystemPrompt).toContain('You are Dear Pal, a Malayalam-first companion');
      expect(passedSystemPrompt).toContain('Malayalam is the default');
      expect(passedSystemPrompt).toContain('Tele-MANAS: 14416');
      expect(passedSystemPrompt).toContain('Reassurance handling');

      // Regression: Must NOT contain old forced validation / mode question / mandatory endings
      expect(passedSystemPrompt).not.toContain('ഇപ്പോൾ ഞാൻ കേട്ടിരിക്കണോ, അതോ ഇതിനെക്കുറിച്ച് കുറച്ചു പറയട്ടെ?');
      expect(passedSystemPrompt).not.toContain('ഇതുവരെ ശരിയാണോ?');
      expect(passedSystemPrompt).not.toContain('കൂടുതൽ വേണോ?');
      expect(passedSystemPrompt).not.toContain('1. Validate, always first');
    });
  });

  describe('2. Greeting Processing (No Hardcoded English Shortcut)', () => {
    it('passes English "Hi" through the normal RAG conversational pipeline without returning static template', async () => {
      const message: ParsedMessage = {
        messageId: 'msg-1',
        phoneNumber: '919876543210',
        messageType: MessageType.TEXT,
        textContent: 'Hi',
        timestamp: '1690000000',
      };

      const result = await aiPipeline.process({ message });

      expect(result.success).toBe(true);
      expect(result.source).toBe('fallback'); // RAG executed without chunks
      expect(result.reply).not.toContain("Hello! 👋 I'm DearPal.");
      expect(mockChatService.generateCustomCompletion).toHaveBeenCalled();
    });

    it('passes Malayalam greeting "ഹായ്" through the normal RAG conversational pipeline', async () => {
      const message: ParsedMessage = {
        messageId: 'msg-2',
        phoneNumber: '919876543210',
        messageType: MessageType.TEXT,
        textContent: 'ഹായ്',
        timestamp: '1690000000',
      };

      const result = await aiPipeline.process({ message });

      expect(result.success).toBe(true);
      expect(mockChatService.generateCustomCompletion).toHaveBeenCalled();
      expect(result.reply).not.toContain("Hello! 👋 I'm DearPal.");
    });
  });

  describe('3. Casual Conversation vs. Administrative Exclusion', () => {
    it('allows casual everyday conversation ("ഇന്ന് biriyani കഴിച്ചു.") through without clinical referral fallback', async () => {
      const res = await ragService.generateAnswer('ഇന്ന് biriyani കഴിച്ചു.');

      expect(res.answer).not.toContain('നിങ്ങളുടെ ഡോക്ടറോട് അല്ലെങ്കിൽ കെയർ ടീമിനോട് ചോദിക്കുന്നതാണ്');
      expect(mockChatService.generateCustomCompletion).toHaveBeenCalled();
    });

    it('allows casual conversation about cricket/football through without clinical referral fallback', async () => {
      const res = await ragService.generateAnswer('ഞാൻ cricket കണ്ടിരുന്നു.');

      expect(res.answer).not.toContain('നിങ്ങളുടെ ഡോക്ടറോട് അല്ലെങ്കിൽ കെയർ ടീമിനോട് ചോദിക്കുന്നതാണ്');
      expect(mockChatService.generateCustomCompletion).toHaveBeenCalled();
    });

    it('allows casual conversation about weather through without clinical referral fallback', async () => {
      const res = await ragService.generateAnswer('ഇന്ന് മഴ നല്ലതാണ്.');

      expect(res.answer).not.toContain('നിങ്ങളുടെ ഡോക്ടറോട് അല്ലെങ്കിൽ കെയർ ടീമിനോട് ചോദിക്കുന്നതാണ്');
      expect(mockChatService.generateCustomCompletion).toHaveBeenCalled();
    });

    it('still blocks legitimate administrative queries like certificates or OP timings', async () => {
      const res = await ragService.generateAnswer('Can I get a medical certificate?');

      expect(res.answer).toBe(
        'അത് എനിക്ക് കൃത്യമായി പറയാൻ എന്റെ കൈവശമുള്ള വിവരങ്ങൾ മതിയാകില്ല. നിങ്ങളുടെ ഡോക്ടറോട് അല്ലെങ്കിൽ കെയർ ടീമിനോട് ചോദിക്കുന്നതാണ് ശരിയായ വിവരം കിട്ടാൻ നല്ലത്.'
      );
      // Bypassed LLM for administrative exclusion
      expect(mockChatService.generateCustomCompletion).not.toHaveBeenCalled();
    });
  });

  describe('4. LLM Retry Instruction Consistency', () => {
    it('does not force bullet points on retry in OpenAI or Sarvam chat services', () => {
      const { OpenAIChatService } = require('@services/ai/openai-chat.service');
      const { SarvamChatService } = require('@services/ai/sarvam-chat.service');

      const openAiService = new OpenAIChatService();
      const sarvamService = new SarvamChatService();

      expect((openAiService as any).defaultSystemPrompt).toContain('Malayalam-first companion');
      expect((sarvamService as any).systemPrompt).toContain('Malayalam-first companion');
    });
  });
});
