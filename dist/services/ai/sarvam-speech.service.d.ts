import { ISpeechService } from "./interfaces";
import { TranscriptionResult } from "../../types/index";
export declare class SarvamSpeechService implements ISpeechService {
    private client;
    transcribe(audioPath: string): Promise<TranscriptionResult>;
}
//# sourceMappingURL=sarvam-speech.service.d.ts.map