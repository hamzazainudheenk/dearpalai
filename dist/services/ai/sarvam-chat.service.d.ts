export interface SarvamCustomCompletionOptions {
    temperature?: number;
    maxTokens?: number;
}
export declare class SarvamChatService {
    private client;
    private readonly systemPrompt;
    generateResponse(userMessage: string): Promise<string>;
    /**
     * Generates a grounded completion using Sarvam 105B with a custom system prompt, user context, and token limits.
     */
    generateCustomCompletion(systemPrompt: string, userMessage: string, options?: SarvamCustomCompletionOptions): Promise<string>;
}
//# sourceMappingURL=sarvam-chat.service.d.ts.map