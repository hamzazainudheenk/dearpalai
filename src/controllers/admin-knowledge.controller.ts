import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { KnowledgeService } from '@services/knowledge/knowledge.service';
import { VectorSearchService } from '@services/knowledge/vector-search.service';
import { EmbeddingService } from '@services/knowledge/embedding.service';
import { RAGService } from '@services/knowledge/rag.service';
import { supabaseAdmin } from '@config/supabase';
import { logger } from '@utils/logger';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export class AdminKnowledgeController {
  private knowledgeService = new KnowledgeService();
  private vectorSearchService = new VectorSearchService();
  private embeddingService = new EmbeddingService();
  private ragService = new RAGService();

  /**
   * POST /api/admin/knowledge/documents
   * Uploads and processes single or batch trusted knowledge documents for RAG.
   */
  async uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const files: Express.Multer.File[] = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
      const { title, description, category } = req.body;

      if (!files || files.length === 0) {
        res.status(400).json({ status: 'error', message: 'Document file is required' });
        return;
      }

      if (!category || !category.trim()) {
        res.status(400).json({ status: 'error', message: 'Document category is required' });
        return;
      }

      const createdDocs: any[] = [];
      const errors: Array<{ fileName: string; error: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // MIME / Extension check
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        const isValidExt = ['pdf', 'docx', 'doc', 'txt'].includes(ext || '');
        const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('text/');

        if (!isValidExt && !isValidMime) {
          errors.push({
            fileName: file.originalname,
            error: `Unsupported file type '.${ext}'. Allowed formats: PDF, DOCX, TXT.`,
          });
          continue;
        }

        // File size check
        if (file.size > MAX_FILE_SIZE) {
          errors.push({
            fileName: file.originalname,
            error: `File size exceeds maximum limit of 25MB. Size: ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
          });
          continue;
        }

        // Determine title for document record
        let docTitle = title?.trim();
        if (!docTitle || files.length > 1) {
          const nameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          docTitle = docTitle ? `${docTitle} - ${nameWithoutExt}` : nameWithoutExt;
        }

        try {
          const document = await this.knowledgeService.uploadDocument(
            file,
            docTitle,
            description?.trim() || '',
            category.trim()
          );
          createdDocs.push(document);
        } catch (fileErr) {
          logger.error('Error uploading file in batch', {
            fileName: file.originalname,
            error: (fileErr as Error).message,
          });
          errors.push({
            fileName: file.originalname,
            error: (fileErr as Error).message,
          });
        }
      }

      const summary = {
        total: files.length,
        successful: createdDocs.length,
        failed: errors.length,
        processing: createdDocs.filter((d) => d.status === 'processing').length,
      };

      res.status(201).json({
        status: 'success',
        message:
          files.length === 1
            ? 'Knowledge document uploaded and processing started'
            : `Batch upload complete: ${summary.successful} queued, ${summary.failed} failed out of ${summary.total} files`,
        summary,
        data: files.length === 1 ? createdDocs[0] : createdDocs,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      logger.error('Error in uploadDocument controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: (err as Error).message || 'Failed to upload document' });
    }
  }

  /**
   * GET /api/admin/knowledge/documents
   * Lists knowledge documents with search, filter, pagination, and aggregate stats.
   */
  async getDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const search = (req.query.search as string) || '';
      const category = (req.query.category as string) || '';
      const status = (req.query.status as string) || '';
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '10', 10);

      const result = await this.knowledgeService.getDocuments({
        search,
        category,
        status,
        page,
        limit,
      });

      res.status(200).json({
        status: 'success',
        data: result.data,
        meta: result.meta,
        stats: result.stats,
      });
    } catch (err) {
      logger.error('Error in getDocuments controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  /**
   * GET /api/admin/knowledge/documents/:id
   * Fetches single document details.
   */
  async getDocumentById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const document = await this.knowledgeService.getDocumentById(id);
      res.status(200).json({ status: 'success', data: document });
    } catch (err) {
      logger.error('Error in getDocumentById controller', { error: (err as Error).message });
      res.status(404).json({ status: 'error', message: (err as Error).message || 'Document not found' });
    }
  }

  /**
   * DELETE /api/admin/knowledge/documents/:id
   * Deletes storage file, chunks, doctor approvals, and document record.
   */
  async deleteDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      await this.knowledgeService.deleteDocument(id);
      res.status(200).json({ status: 'success', message: 'Knowledge document deleted successfully' });
    } catch (err) {
      logger.error('Error in deleteDocument controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: (err as Error).message || 'Failed to delete document' });
    }
  }

  /**
   * POST /api/admin/knowledge/documents/:id/reprocess
   * Re-extracts text and re-chunks document content.
   */
  async reprocessDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const document = await this.knowledgeService.reprocessDocument(id);
      res.status(200).json({
        status: 'success',
        message: 'Knowledge document reprocessing initiated',
        data: document,
      });
    } catch (err) {
      logger.error('Error in reprocessDocument controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: (err as Error).message || 'Failed to reprocess document' });
    }
  }

  /**
   * POST /api/admin/knowledge/search
   * Vector similarity search dev/test endpoint.
   */
  async searchKnowledge(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query, topK, threshold } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ status: 'error', message: 'Query string is required' });
        return;
      }

      const results = await this.vectorSearchService.searchSimilarChunks(query, {
        topK: topK ? parseInt(String(topK), 10) : undefined,
        threshold: threshold ? parseFloat(String(threshold)) : undefined,
      });

      res.status(200).json({
        status: 'success',
        data: {
          query: query.trim(),
          results,
        },
      });
    } catch (err) {
      logger.error('Error in searchKnowledge controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: (err as Error).message || 'Vector similarity search failed' });
    }
  }

  /**
   * POST /api/admin/knowledge/debug-search
   * Admin diagnostic endpoint for vector retrieval inspection.
   */
  async debugSearchKnowledge(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ status: 'error', message: 'Query string is required' });
        return;
      }

      const trimmedQuery = query.trim();
      const embeddingResult = await this.embeddingService.getEmbedding(trimmedQuery);
      const queryEmbedding = embeddingResult.embedding;

      const { count: totalChunks } = await supabaseAdmin
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true });

      const { count: chunksWithEmbeddings } = await supabaseAdmin
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .not('embedding', 'is', null);

      const { count: approvedDocs } = await supabaseAdmin
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('approved', true);

      const { count: completedDocs } = await supabaseAdmin
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      const { data: rpcMatches } = await supabaseAdmin.rpc('match_knowledge_chunks', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: 5,
        similarity_threshold: 0.0,
      });

      const topSimilarities = (rpcMatches || []).map((m: any) => ({
        chunkId: m.chunk_id,
        documentTitle: m.document_title,
        similarity: Number(m.similarity_score ? Number(m.similarity_score).toFixed(4) : 0),
        chunkTextSnippet: m.chunk_text ? m.chunk_text.substring(0, 120) : '',
      }));

      res.status(200).json({
        query: trimmedQuery,
        queryEmbeddingDimensions: queryEmbedding?.length || 0,
        totalKnowledgeChunks: totalChunks || 0,
        chunksWithEmbeddings: chunksWithEmbeddings || 0,
        approvedDocuments: approvedDocs || 0,
        completedDocuments: completedDocs || 0,
        topSimilarities,
      });
    } catch (err) {
      logger.error('Error in debugSearchKnowledge controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: (err as Error).message || 'Debug search failed' });
    }
  }

  /**
   * POST /api/admin/knowledge/ask
   * RAG generation dev/test endpoint: Vector retrieval + RAGContextBuilder + Sarvam 105B generation.
   */
  async askKnowledge(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query, topK, threshold } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ status: 'error', message: 'Query string is required' });
        return;
      }

      const ragResponse = await this.ragService.generateAnswer(query, {
        topK: topK ? parseInt(String(topK), 10) : undefined,
        threshold: threshold ? parseFloat(String(threshold)) : undefined,
      });

      res.status(200).json({
        status: 'success',
        data: {
          answer: ragResponse.answer,
          sources: ragResponse.sources,
        },
      });
    } catch (err) {
      logger.error('Error in askKnowledge controller', { error: (err as Error).message });
      res.status(500).json({ status: 'error', message: (err as Error).message || 'RAG generation failed' });
    }
  }
}
