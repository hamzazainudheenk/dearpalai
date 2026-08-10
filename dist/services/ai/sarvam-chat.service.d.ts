export declare class SarvamChatService {
    private client;
    private readonly systemPrompt;
    generateResponse(userMessage: string): Promise<string>;
    /**
     * Generates a grounded completion using Sarvam 105B with a custom system prompt and user message context.
     */
    generateCustomCompletion(systemPrompt: string, userMessage: string, temperature?: number): Promise<string>;
}
//# sourceMappingURL=sarvam-chat.service.d.ts.map