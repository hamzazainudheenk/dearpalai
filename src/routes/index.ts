/**
 * Route Aggregator
 *
 * Mounts all route groups and provides a health check endpoint.
 */

import { Router, Request, Response } from 'express';
import webhookRoutes from './webhook.routes';
import patientRoutes from './patient.routes';
import sessionRoutes from './session.routes';
import conversationRoutes from './conversation.routes';
import dashboardRoutes from './dashboard.routes';
import adminKnowledgeRoutes from './admin-knowledge.routes';

const router = Router();

/**
 * GET /health
 * Health check endpoint for load balancers and monitoring.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'dearpal-whatsapp',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/** Mount WhatsApp webhook routes at /webhook */
router.use('/webhook', webhookRoutes);

/** Mount REST API routes for DearPal Frontend */
router.use('/api/patients', patientRoutes);
router.use('/api/patients/:id/sessions', sessionRoutes);
router.use('/api/patients/:id/conversations', conversationRoutes);
router.use('/api/dashboard', dashboardRoutes);

/** Mount Admin Knowledge Base API routes */
router.use('/api/admin/knowledge', adminKnowledgeRoutes);

export default router;
