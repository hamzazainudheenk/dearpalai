import { SarvamAIClient } from "sarvamai";
import fs from "fs";
import { ISpeechService } from "./interfaces";
import { TranscriptionResult } from "@app-types/index";
import { logger } from "@utils/logger";

export class SarvamSpeechService implements ISpeechService {
  private client = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY!,
  });

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    logger.info("Calling Sarvam Speech-to-Text", { audioPath });

    const audioFile = fs.createReadStream(audioPath);

    const response = await this.client.speechToText.transcribe({
      file: audioFile,
      model: "saaras:v3",
      mode: "transcribe",
    });
    console.log(response);
    logger.info("Sarvam transcription complete");

    return {
      text: response.transcript,
      confidence: 1.0,
      language: response.language_code ?? "unknown",
      durationSeconds: 0,
    };
  }
}