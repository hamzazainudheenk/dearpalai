import { SarvamAIClient } from 'sarvamai';
import { ITextToSpeechService } from './interfaces';
import { logger } from '@utils/logger';

/**
 * Sarvam Text-to-Speech Service using Bulbul v3.
 * Converts Malayalam response text into spoken audio Buffer (Opus codec).
 */
export class SarvamTextToSpeechService implements ITextToSpeechService {
  private client = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY!,
  });

  /**
   * Converts text into spoken audio Buffer using Sarvam Bulbul v3.
   *
   * @param text - Final Malayalam text response
   * @returns Node.js Buffer containing the decoded Opus audio data
   */
  async textToSpeech(text: string): Promise<Buffer> {
    const startTime = Date.now();
    logger.info('Calling Sarvam Bulbul v3 Text-to-Speech', {
      textLength: text?.length || 0,
    });

    try {
      const response = await this.client.textToSpeech.convert({
        text,
        target_language_code: 'ml-IN',
        model: 'bulbul:v3',
        speaker: 'ritu',
        output_audio_codec: 'opus',
        speech_sample_rate: 24000,
      });

      const durationMs = Date.now() - startTime;
      const base64Audio = response.audios?.[0];

      if (!base64Audio) {
        logger.error('Sarvam TTS returned empty audio payload', { durationMs });
        throw new Error('Sarvam TTS API returned empty audio response payload');
      }

      const audioBuffer = Buffer.from(base64Audio, 'base64');

      logger.info('Sarvam Bulbul v3 TTS conversion complete', {
        durationMs,
        audioSizeBytes: audioBuffer.length,
        model: 'bulbul:v3',
        codec: 'opus',
        speaker: 'shubh',
        sampleRate: 24000,
      });

      return audioBuffer;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error('Sarvam TTS conversion failed', {
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
