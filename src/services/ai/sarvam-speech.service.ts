import { SarvamAIClient } from "sarvamai";
import fs from "fs";
import { ISpeechService } from "./interfaces";
import { TranscriptionResult } from "@app-types/index";
import { logger } from "@utils/logger";

export class SarvamSpeechService implements ISpeechService {
  private client = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY!,
  });

  async transcribe(audioPath: string, languageCode: string = "ml-IN"): Promise<TranscriptionResult> {
    logger.info("Calling Sarvam Speech-to-Text", { audioPath, languageCode });

    const audioFile = fs.createReadStream(audioPath);

    const response = await this.client.speechToText.transcribe({
      file: audioFile,
      model: "saaras:v3",
      language_code: languageCode as any,
      mode: "transcribe",
    });
    logger.info("Sarvam transcription complete", {
      transcript: response.transcript,
      language: response.language_code,
    });

    return {
      text: response.transcript,
      confidence: 1.0,
      language: response.language_code ?? languageCode,
      durationSeconds: 0,
    };
  }
}