/**
 * AI Configuration
 *
 * Centralized configuration for all AI, Embedding, Translation, Vector DB, and RAG services.
 * Loaded from environment variables with sensible defaults.
 */

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const aiConfig = {
  /** Sarvam AI Speech-to-Text configuration */
  sarvam: {
    apiKey: optionalEnv('SARVAM_API_KEY', ''),
    apiUrl: optionalEnv('SARVAM_API_URL', 'https://api.sarvam.ai'),
    /** Default language for transcription */
    defaultLanguage: optionalEnv('SARVAM_DEFAULT_LANGUAGE', 'hi'),
    /** Request timeout in milliseconds */
    timeoutMs: parseInt(optionalEnv('SARVAM_TIMEOUT_MS', '30000'), 10),
  },

  /** Translation configuration (Sarvam Translate API) */
  translation: {
    provider: optionalEnv('TRANSLATION_PROVIDER', 'sarvam'),
    model: optionalEnv('TRANSLATION_MODEL', 'mayura:v1'),
    apiUrl: optionalEnv('TRANSLATION_API_URL', 'https://api.sarvam.ai/translate'),
    enabled: optionalEnv('TRANSLATION_ENABLED', 'true') === 'true',
  },

  /** OpenAI / LLM configuration */
  openai: {
    apiKey: optionalEnv('OPENAI_API_KEY', ''),
    model: optionalEnv('OPENAI_MODEL', 'gpt-4'),
    /** Max tokens for completions */
    maxTokens: parseInt(optionalEnv('OPENAI_MAX_TOKENS', '1024'), 10),
    /** Temperature for completions */
    temperature: parseFloat(optionalEnv('OPENAI_TEMPERATURE', '0.7')),
  },

  /** OpenAI Embedding API configuration (text-embedding-3-small, 384 dimensions) */
  embedding: {
    provider: optionalEnv('EMBEDDING_PROVIDER', 'openai'),
    model: optionalEnv('EMBEDDING_MODEL', 'text-embedding-3-small'),
    /** Multilingual embedding vector dimensions */
    dimensions: parseInt(optionalEnv('EMBEDDING_DIMENSIONS', '384'), 10),
  },

  /** Vector database configuration */
  vectorDb: {
    provider: optionalEnv('VECTOR_DB_PROVIDER', 'pgvector'),
    url: optionalEnv('VECTOR_DB_URL', ''),
    apiKey: optionalEnv('VECTOR_DB_API_KEY', ''),
    /** Index/collection name */
    indexName: optionalEnv('VECTOR_DB_INDEX', 'knowledge_chunks'),
  },

  /** RAG (Retrieval-Augmented Generation) configuration */
  rag: {
    /** Minimum similarity score to consider a document relevant (0.3 default threshold for cosine similarity) */
    similarityThreshold: parseFloat(optionalEnv('RAG_SIMILARITY_THRESHOLD', '0.3')),
    /** Maximum number of documents to retrieve */
    maxResults: parseInt(optionalEnv('RAG_MAX_RESULTS', '5'), 10),
    /** Whether to include source citations in responses */
    includeCitations: optionalEnv('RAG_INCLUDE_CITATIONS', 'true') === 'true',
  },

  /** Risk assessment configuration */
  risk: {
    /** Threshold above which a message is flagged as high-risk */
    threshold: parseFloat(optionalEnv('RISK_THRESHOLD', '0.8')),
    /** Whether to enable real-time risk assessment */
    enabled: optionalEnv('RISK_ASSESSMENT_ENABLED', 'false') === 'true',
  },

  /** Pipeline configuration */
  pipeline: {
    /** Whether to run the full AI pipeline */
    enabled: optionalEnv('AI_PIPELINE_ENABLED', 'false') === 'true',
    /** Timeout for the entire pipeline in milliseconds */
    timeoutMs: parseInt(optionalEnv('AI_PIPELINE_TIMEOUT_MS', '60000'), 10),
  },
} as const;

export type AIConfig = typeof aiConfig;
