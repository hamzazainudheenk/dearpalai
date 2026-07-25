import { IDecisionEngine } from './interfaces';
import {
  DecisionResult,
  TranscriptionResult,
  RagResult,
  RiskAssessmentResult,
} from '@app-types/index';
import { SarvamChatService } from './sarvam-chat.service';
import { logger } from '@utils/logger';

export class DecisionEngineService implements IDecisionEngine {
  constructor(private readonly sarvamChatService: SarvamChatService) {}

  /**
   * Makes a decision on how to respond to a message by invoking SarvamChatService.
   *
   * @param input - Aggregated pipeline outputs (transcript or text message)
   * @returns Decision result containing Sarvam AI generated reply
   */
  async decide(input: {
    message: string;
    transcription?: TranscriptionResult;
    ragResult?: RagResult;
    riskAssessment?: RiskAssessmentResult;
  }): Promise<DecisionResult> {
    const userText = input.transcription?.text || input.message;

    logger.info('DecisionEngine processing message with SarvamChatService', {
      userTextLength: userText.length,
      hasTranscription: !!input.transcription,
    });

    try {
      const aiReply = await this.sarvamChatService.generateResponse(userText);

      return {
        reply: aiReply,
        confidence: 1.0,
        source: 'ai',
        shouldEscalate: false,
        reasoning: 'Generated response using Sarvam Chat completion API (sarvam-30b)',
      };
    } catch (error) {
      logger.error('DecisionEngine failed to get response from SarvamChatService', {
        error: (error as Error).message,
      });

      throw error;
    }
  }
}
