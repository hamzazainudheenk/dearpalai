import { Router } from 'express';
import multer from 'multer';
import { AdminKnowledgeController } from '@controllers/admin-knowledge.controller';
import { authenticateDoctor, requireAdmin } from '@middleware/auth.middleware';

const router = Router();
const controller = new AdminKnowledgeController();

// Configure multer for memory storage file uploads (up to 25MB)
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
 * Upload document file and process into knowledge base
 */
router.post('/documents', upload.single('file'), (req, res) => controller.uploadDocument(req, res));

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

export default router;
