/**
 * AI Configuration
 *
 * Centralized configuration for all AI, Embedding, Translation, Vector DB, and RAG services.
 * Loaded from environment variables with sensible defaults.
 */
export declare const aiConfig: {
    /** Active AI/LLM Provider ('openai' or 'sarvam') */
    readonly aiProvider: string;
    /** Sarvam AI Speech-to-Text configuration */
    readonly sarvam: {
        readonly apiKey: string;
        readonly apiUrl: string;
        /** Default language for transcription */
        readonly defaultLanguage: string;
        /** Request timeout in milliseconds */
        readonly timeoutMs: number;
    };
    /** Translation configuration (Sarvam Translate API) */
    readonly translation: {
        readonly provider: string;
        readonly model: string;
        readonly apiUrl: string;
        readonly enabled: boolean;
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
    /** OpenAI Embedding API configuration (text-embedding-3-small, 384 dimensions) */
    readonly embedding: {
        readonly provider: string;
        readonly model: string;
        /** Multilingual embedding vector dimensions */
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
        /** Minimum similarity score to consider a document relevant (0.3 default threshold for cosine similarity) */
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
        /** Whether to run the full AI pipeline */
        readonly enabled: boolean;
        /** Timeout for the entire pipeline in milliseconds */
        readonly timeoutMs: number;
    };
};
export type AIConfig = typeof aiConfig;
//# sourceMappingURL=ai.d.ts.map