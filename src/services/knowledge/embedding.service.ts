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
 * Free local ONNX Transformer Embedding Provider (`Xenova/all-MiniLM-L6-v2`).
 * Generates real 384-dimensional vector embeddings locally in Node.js memory ($0 cost, 0 API keys).
 */
export class TransformersEmbeddingProvider implements IEmbeddingProvider {
  private pipelineInstance: any = null;
  private isInitializing = false;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  private readonly dimensions = 384;

  private async getPipeline() {
    if (this.pipelineInstance) return this.pipelineInstance;

    if (!this.isInitializing) {
      this.isInitializing = true;
      try {
        logger.info(`Initializing local embedding model '${this.modelName}'...`);
        const { pipeline } = await import('@xenova/transformers');
        this.pipelineInstance = await pipeline('feature-extraction', this.modelName);
        logger.info(`Local embedding model '${this.modelName}' loaded successfully`);
      } catch (err) {
        logger.warn('Failed to load @xenova/transformers pipeline, using fallback vector generator', {
          error: (err as Error).message,
        });
      } finally {
        this.isInitializing = false;
      }
    }
    return this.pipelineInstance;
  }

  /**
   * Generates a 384-dimensional vector embedding for text.
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const pipe = await this.getPipeline();

    if (pipe) {
      try {
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data) as number[];
        return {
          embedding: vector.slice(0, this.dimensions),
          model: this.modelName,
          dimensions: this.dimensions,
        };
      } catch (err) {
        logger.warn('Error running transformers pipeline, falling back to normalized feature vector', {
          error: (err as Error).message,
        });
      }
    }

    // Fallback 384-dim normalized feature vector
    const vector: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      const charCode = text.charCodeAt(i % text.length) || 0;
      vector.push(Math.sin(charCode * 0.13 + i * 0.07) * 0.5 + 0.5);
    }

    // Normalize vector length to 1.0
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
    const normalized = vector.map((v) => v / magnitude);

    return {
      embedding: normalized,
      model: `${this.modelName}-fallback`,
      dimensions: this.dimensions,
    };
  }

  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    logger.info(`Generating ${texts.length} embeddings with ${this.modelName}...`);
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}

export class EmbeddingService {
  constructor(private provider: IEmbeddingProvider = new TransformersEmbeddingProvider()) {}

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
