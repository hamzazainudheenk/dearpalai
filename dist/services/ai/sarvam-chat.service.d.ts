export interface SarvamCustomCompletionOptions {
    temperature?: number;
    maxTokens?: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
    isRetry?: boolean;
    outerStartTime?: number;
}
export declare class SarvamChatService {
    private client;
    private readonly systemPrompt;
    generateResponse(userMessage: string): Promise<string>;
    /**
     * Generates a grounded completion using Sarvam 105B with custom system prompt, user context, token limits,
     * reasoning effort controls, and safe single-retry handling if truncated (finishReason === "length").
     */
    generateCustomCompletion(systemPrompt: string, userMessage: string, options?: SarvamCustomCompletionOptions): Promise<string>;
}
//# sourceMappingURL=sarvam-chat.service.d.ts.map