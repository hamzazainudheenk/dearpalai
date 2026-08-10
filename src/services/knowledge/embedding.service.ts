import { logger } from '@utils/logger';

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
 * Default Mock / Extensible Embedding Provider.
 * Can be swapped with OpenAI text-embedding-3, FastEmbed, or Sarvam embedding service when available.
 */
export class DefaultEmbeddingProvider implements IEmbeddingProvider {
  private readonly dimensions = 384;
  private readonly modelName = 'dearpal-dense-v1';

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Generate deterministic 384-dimensional normalized vector for prototype/RAG structure
    const vector = new Array(this.dimensions).fill(0).map((_, i) => {
      const charCode = text.charCodeAt(i % text.length) || 0;
      return Math.sin(charCode + i) * 0.1;
    });

    return {
      embedding: vector,
      model: this.modelName,
      dimensions: this.dimensions,
    };
  }

  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}

export class EmbeddingService {
  constructor(private provider: IEmbeddingProvider = new DefaultEmbeddingProvider()) {}

  /**
   * Generates vector embeddings for a chunk of text.
   */
  async getEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      return await this.provider.generateEmbedding(text);
    } catch (err) {
      logger.error('Failed to generate embedding', { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Generates vector embeddings for a batch of text chunks.
   */
  async getBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      return await this.provider.generateBatchEmbeddings(texts);
    } catch (err) {
      logger.error('Failed to generate batch embeddings', { error: (err as Error).message });
      throw err;
    }
  }
}
