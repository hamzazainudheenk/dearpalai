import OpenAI from 'openai';
import { logger } from '@utils/logger';
import { aiConfig } from '@config/ai';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface IEmbeddingProvider {
  generateEmbedding(text: string): Promise<EmbeddingResult>;
  generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]>;
}

/**
 * OpenAI Cloud Embedding Provider (`text-embedding-3-small`).
 * Offloads vector embedding generation to OpenAI API with 384 dimensions.
 * Completely eliminates local ONNX model loading from Node memory, optimizing for Render 512MB RAM limit.
 */
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private client: OpenAI | null = null;
  private readonly modelName = aiConfig.embedding.model;
  private readonly dimensions = aiConfig.embedding.dimensions;

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.OPENAI_API_KEY || aiConfig.openai.apiKey;
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_openai_api_key_here')) {
      logger.error('OPENAI_API_KEY environment variable is missing or invalid');
      throw new Error('OPENAI_API_KEY environment variable is not configured. Cannot generate embeddings.');
    }

    this.client = new OpenAI({ apiKey: apiKey.trim() });
    return this.client;
  }

  /**
   * Generates a 384-dimensional vector embedding using OpenAI API.
   * Sends raw text directly to OpenAI API (without E5 query/passage prefixes).
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const trimmed = text?.trim() || '';
    if (!trimmed) {
      throw new Error('Text to embed cannot be empty');
    }

    const openai = this.getClient();

    try {
      const response = await openai.embeddings.create({
        model: this.modelName,
        input: trimmed,
        dimensions: this.dimensions,
      });

      const vector = response.data[0]?.embedding;

      // Validate returned vector dimension
      if (!vector || vector.length !== this.dimensions) {
        logger.error('Embedding dimension mismatch from OpenAI API', {
          expected: this.dimensions,
          received: vector?.length || 0,
        });
        throw new Error(`Embedding dimension mismatch: expected ${this.dimensions}, received ${vector?.length || 0}`);
      }

      const durationMs = Date.now() - startTime;
      logger.info('OpenAI embedding generated', {
        model: this.modelName,
        dimensions: this.dimensions,
        textLength: trimmed.length,
        durationMs,
        promptTokens: response.usage?.prompt_tokens,
      });

      return {
        embedding: vector,
        model: this.modelName,
        dimensions: this.dimensions,
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'OpenAI API embedding request failed';
      logger.error('OpenAI embedding generation failed', {
        model: this.modelName,
        status: err?.status,
        code: err?.code,
        error: errorMsg,
      });
      throw new Error(`OpenAI embedding failed: ${errorMsg}`);
    }
  }

  /**
   * Generates 384-dimensional vector embeddings for a batch of texts using OpenAI API.
   * Batching minimizes network overhead while enforcing safety limits.
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const trimmedTexts = texts.map((t) => t?.trim() || '').filter((t) => t.length > 0);
    if (trimmedTexts.length === 0) {
      return [];
    }

    logger.info(`Generating batch ${trimmedTexts.length} embeddings with OpenAI ${this.modelName}...`);
    const openai = this.getClient();
    const results: EmbeddingResult[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < trimmedTexts.length; i += BATCH_SIZE) {
      const batch = trimmedTexts.slice(i, i + BATCH_SIZE);
      const startTime = Date.now();

      try {
        const response = await openai.embeddings.create({
          model: this.modelName,
          input: batch,
          dimensions: this.dimensions,
        });

        const durationMs = Date.now() - startTime;
        logger.info(`Batch embeddings generated (${i + 1}-${i + batch.length}/${trimmedTexts.length})`, {
          model: this.modelName,
          batchCount: batch.length,
          dimensions: this.dimensions,
          durationMs,
          promptTokens: response.usage?.prompt_tokens,
        });

        for (const item of response.data) {
          const vector = item.embedding;
          if (!vector || vector.length !== this.dimensions) {
            throw new Error(`Embedding dimension mismatch in batch item ${item.index}: expected ${this.dimensions}, received ${vector?.length || 0}`);
          }
          results[i + item.index] = {
            embedding: vector,
            model: this.modelName,
            dimensions: this.dimensions,
          };
        }
      } catch (err: any) {
        const errorMsg = err?.message || 'OpenAI API batch embedding request failed';
        logger.error('OpenAI batch embedding generation failed', {
          batchStartIndex: i,
          batchSize: batch.length,
          error: errorMsg,
        });
        throw new Error(`OpenAI batch embedding failed: ${errorMsg}`);
      }
    }

    return results;
  }
}

export class EmbeddingService {
  constructor(private provider: IEmbeddingProvider = new OpenAIEmbeddingProvider()) {}

  async getEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      return await this.provider.generateEmbedding(text);
    } catch (err) {
      logger.error('Failed to generate embedding', { error: (err as Error).message });
      throw err;
    }
  }

  async getBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      return await this.provider.generateBatchEmbeddings(texts);
    } catch (err) {
      logger.error('Failed to generate batch embeddings', { error: (err as Error).message });
      throw err;
    }
  }
}
