import { IChatService, CustomCompletionOptions } from './interfaces';
export interface SarvamCustomCompletionOptions extends CustomCompletionOptions {
}
export declare class SarvamChatService implements IChatService {
    private client;
    private readonly systemPrompt;
    generateResponse(userMessage: string): Promise<string>;
    /**
     * Generates a grounded completion using sarvam-105b-conversations with custom system prompt, user context, token limits,
     * reasoning effort controls, and safe single-retry handling if truncated (finishReason === "length").
     */
    generateCustomCompletion(systemPrompt: string, userMessage: string, options?: SarvamCustomCompletionOptions): Promise<string>;
}
//# sourceMappingURL=sarvam-chat.service.d.ts.map