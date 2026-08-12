import { Router } from 'express';
import multer from 'multer';
import { AdminKnowledgeController } from '@controllers/admin-knowledge.controller';
import { authenticateDoctor, requireAdmin } from '@middleware/auth.middleware';

const router = Router();
const controller = new AdminKnowledgeController();

// Configure multer for memory storage file uploads (up to 25MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

// Protect all admin knowledge base routes with authentication & admin authorization
router.use(authenticateDoctor);
router.use(requireAdmin);

/**
 * POST /api/admin/knowledge/documents
 * Upload single or batch document files and process into knowledge base
 */
router.post('/documents', upload.any(), (req, res) => controller.uploadDocument(req, res));

/**
 * GET /api/admin/knowledge/documents
 * List all knowledge documents with search, category, status filters & stats
 */
router.get('/documents', (req, res) => controller.getDocuments(req, res));

/**
 * GET /api/admin/knowledge/documents/:id
 * Get details for a single knowledge document
 */
router.get('/documents/:id', (req, res) => controller.getDocumentById(req, res));

/**
 * DELETE /api/admin/knowledge/documents/:id
 * Delete document, storage file, chunks, and doctor approvals
 */
router.delete('/documents/:id', (req, res) => controller.deleteDocument(req, res));

/**
 * POST /api/admin/knowledge/documents/:id/reprocess
 * Reprocess document
 */
router.post('/documents/:id/reprocess', (req, res) => controller.reprocessDocument(req, res));

/**
 * POST /api/admin/knowledge/search
 * Vector similarity search dev/test endpoint
 */
router.post('/search', (req, res) => controller.searchKnowledge(req, res));

/**
 * POST /api/admin/knowledge/debug-search
 * Vector similarity search diagnostic endpoint
 */
router.post('/debug-search', (req, res) => controller.debugSearchKnowledge(req, res));

/**
 * POST /api/admin/knowledge/ask
 * RAG generation dev/test endpoint (Retrieval + Context Builder + Sarvam 105B)
 */
router.post('/ask', (req, res) => controller.askKnowledge(req, res));

export default router;
