import { supabaseAdmin } from '@config/supabase';
import { DocumentExtractorService } from './document-extractor.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeRepository } from './knowledge.repository';
import { logger } from '@utils/logger';

export class DocumentProcessingService {
  private extractor = new DocumentExtractorService();
  private chunker = new ChunkingService();
  private embeddingService = new EmbeddingService();
  private repository = new KnowledgeRepository();
  private readonly bucketName = 'knowledge-base';

  /**
   * Orchestrates the document processing flow end-to-end:
   * Download from Storage → Extract text → Clean & Chunk → Generate embeddings → Store chunks → Update status
   */
  async process(documentId: string, storagePath: string, mimeType: string, fileName: string, fileBuffer?: Buffer): Promise<void> {
    logger.info('Starting document processing pipeline', { documentId, storagePath, fileName });

    try {
      // 1. Set status to processing
      await this.repository.updateDocumentStatus(documentId, 'processing');

      // 2. Download document from Supabase Storage if buffer not passed directly
      let buffer = fileBuffer;
      if (!buffer) {
        logger.info('Downloading file from Supabase Storage for processing', { storagePath });
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from(this.bucketName)
          .download(storagePath);

        if (downloadError || !fileData) {
          throw new Error(`Failed to download file from Supabase Storage: ${downloadError?.message}`);
        }

        const arrayBuffer = await fileData.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      // 3. Extract text
      const extractedText = await this.extractor.extractText(buffer, mimeType, fileName);

      // 4. Chunk text
      const chunks = this.chunker.chunkText(extractedText);

      // 5. Generate embeddings for each chunk
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = chunkTexts.length > 0 ? await this.embeddingService.getBatchEmbeddings(chunkTexts) : [];

      const enrichedChunks = chunks.map((c, i) => ({
        ...c,
        embedding: embeddings[i]?.embedding,
      }));

      // 6. Store chunks and vector embeddings in database
      await this.repository.storeChunks(documentId, enrichedChunks, fileName);

      // 7. Update document status to completed
      await this.repository.updateDocumentStatus(documentId, 'completed', enrichedChunks.length);

      logger.info('Document processing pipeline completed successfully', {
        documentId,
        chunksCount: enrichedChunks.length,
      });
    } catch (err) {
      logger.error('Document processing pipeline failed', { documentId, error: (err as Error).message });
      await this.repository.updateDocumentStatus(documentId, 'failed');
    }
  }
}
