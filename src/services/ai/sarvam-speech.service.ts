/**
 * Sarvam Speech-to-Text Service (Mock Implementation)
 *
 * Phase 1: Returns mock transcription results.
 * Phase 2: Will integrate with Sarvam AI API for
 *          multilingual speech-to-text (Hindi, English, etc.)
 */

import { ISpeechService } from './interfaces';
import { TranscriptionResult } from '@app-types/index';
import { logger } from '@utils/logger';

export class SarvamSpeechService implements ISpeechService {
  /**
   * Transcribes an audio file to text.
   *
   * @param audioPath - Path to the audio file
   * @returns Mock transcription result
   */
  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    logger.info('[Mock] Sarvam Speech-to-Text called', { audioPath });

    // Phase 2: Replace with actual Sarvam AI API call
    // const response = await axios.post(aiConfig.sarvam.apiUrl + '/v1/transcribe', ...);

    return {
      text: '[Mock transcription] — Sarvam AI integration pending',
      confidence: 0.0,
      language: 'hi',
      durationSeconds: 0,
    };
  }
}
