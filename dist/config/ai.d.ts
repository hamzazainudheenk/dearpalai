/**
 * AI Configuration (Phase 2 Placeholder)
 *
 * Centralized configuration for all AI services.
 * Values are loaded from environment variables but are NOT
 * required for Phase 1 — they default to placeholder values.
 *
 * This file exists so that when Phase 2 AI services are
 * implemented, all configuration is already centralized
 * and does not require changes across the codebase.
 */
export declare const aiConfig: {
    /** Sarvam AI Speech-to-Text configuration */
    readonly sarvam: {
        readonly apiKey: string;
        readonly apiUrl: string;
        /** Default language for transcription */
        readonly defaultLanguage: string;
        /** Request timeout in milliseconds */
        readonly timeoutMs: number;
    };
    /** OpenAI / LLM configuration */
    readonly openai: {
        readonly apiKey: string;
        readonly model: string;
        /** Max tokens for completions */
        readonly maxTokens: number;
        /** Temperature for completions */
        readonly temperature: number;
    };
    /** Embedding configuration */
    readonly embedding: {
        readonly provider: string;
        readonly model: string;
        /** Embedding vector dimensions */
        readonly dimensions: number;
    };
    /** Vector database configuration */
    readonly vectorDb: {
        readonly provider: string;
        readonly url: string;
        readonly apiKey: string;
        /** Index/collection name */
        readonly indexName: string;
    };
    /** RAG (Retrieval-Augmented Generation) configuration */
    readonly rag: {
        /** Minimum similarity score to consider a document relevant */
        readonly similarityThreshold: number;
        /** Maximum number of documents to retrieve */
        readonly maxResults: number;
        /** Whether to include source citations in responses */
        readonly includeCitations: boolean;
    };
    /** Risk assessment configuration */
    readonly risk: {
        /** Threshold above which a message is flagged as high-risk */
        readonly threshold: number;
        /** Whether to enable real-time risk assessment */
        readonly enabled: boolean;
    };
    /** Pipeline configuration */
    readonly pipeline: {
        /** Whether to run the full AI pipeline (Phase 2) */
        readonly enabled: boolean;
        /** Timeout for the entire pipeline in milliseconds */
        readonly timeoutMs: number;
    };
};
export type AIConfig = typeof aiConfig;
//# sourceMappingURL=ai.d.ts.map