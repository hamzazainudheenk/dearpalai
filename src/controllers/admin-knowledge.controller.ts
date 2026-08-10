import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { KnowledgeService } from '@services/knowledge/knowledge.service';
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

  /**
   * POST /api/admin/knowledge/documents
   * Uploads and processes a new trusted knowledge document for RAG.
   */
  async uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const file = req.file;
      const { title, description, category } = req.body;

      if (!file) {
        res.status(400).json({ status: 'error', message: 'Document file is required' });
        return;
      }

      if (!title || !title.trim()) {
        res.status(400).json({ status: 'error', message: 'Document title is required' });
        return;
      }

      if (!category || !category.trim()) {
        res.status(400).json({ status: 'error', message: 'Document category is required' });
        return;
      }

      // MIME type check
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      const isValidExt = ['pdf', 'docx', 'doc', 'txt'].includes(ext || '');
      const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('text/');

      if (!isValidExt && !isValidMime) {
        res.status(400).json({
          status: 'error',
          message: 'Unsupported file type. Allowed formats: PDF, DOCX, TXT',
        });
        return;
      }

      // File size check
      if (file.size > MAX_FILE_SIZE) {
        res.status(400).json({
          status: 'error',
          message: `File size exceeds maximum limit of 25MB. Uploaded size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
        });
        return;
      }

      const document = await this.knowledgeService.uploadDocument(
        file,
        title,
        description || '',
        category
      );

      res.status(201).json({
        status: 'success',
        message: 'Knowledge document uploaded and processing started',
        data: document,
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
}
