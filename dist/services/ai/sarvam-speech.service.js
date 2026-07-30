"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SarvamSpeechService = void 0;
const sarvamai_1 = require("sarvamai");
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../../utils/logger");
class SarvamSpeechService {
    constructor() {
        this.client = new sarvamai_1.SarvamAIClient({
            apiSubscriptionKey: process.env.SARVAM_API_KEY,
        });
    }
    async transcribe(audioPath) {
        logger_1.logger.info("Calling Sarvam Speech-to-Text", { audioPath });
        const audioFile = fs_1.default.createReadStream(audioPath);
        const response = await this.client.speechToText.transcribe({
            file: audioFile,
            model: "saaras:v3",
            mode: "transcribe",
        });
        console.log(response);
        logger_1.logger.info("Sarvam transcription complete");
        return {
            text: response.transcript,
            confidence: 1.0,
            language: response.language_code ?? "unknown",
            durationSeconds: 0,
        };
    }
}
exports.SarvamSpeechService = SarvamSpeechService;
//# sourceMappingURL=sarvam-speech.service.js.map