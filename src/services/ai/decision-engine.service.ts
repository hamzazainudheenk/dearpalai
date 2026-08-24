import { IDecisionEngine, IChatService } from './interfaces';
import {
  DecisionResult,
  TranscriptionResult,
  RagResult,
  RiskAssessmentResult,
} from '@app-types/index';
import { logger } from '@utils/logger';

export class DecisionEngineService implements IDecisionEngine {
  constructor(private readonly chatService: IChatService) {}

  /**
   * Makes a decision on how to respond to a message by invoking the configured IChatService.
   *
   * @param input - Aggregated pipeline outputs (transcript or text message)
   * @returns Decision result containing AI generated reply
   */
  async decide(input: {
    message: string;
    transcription?: TranscriptionResult;
    ragResult?: RagResult;
    riskAssessment?: RiskAssessmentResult;
  }): Promise<DecisionResult> {
    const userText = input.transcription?.text || input.message;

    logger.info('DecisionEngine processing message with ChatService', {
      userTextLength: userText.length,
      hasTranscription: !!input.transcription,
    });

    try {
      const aiReply = await this.chatService.generateResponse(userText);

      return {
        reply: aiReply,
        confidence: 1.0,
        source: 'ai',
        shouldEscalate: false,
        reasoning: 'Generated response using configured IChatService completion API',
      };
    } catch (error) {
      logger.error('DecisionEngine failed to get response from ChatService', {
        error: (error as Error).message,
      });

      throw error;
    }
  }
}
