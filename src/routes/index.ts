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
import patientAuthRoutes from './patient-auth.routes';
import caretakerAuthRoutes from './caretaker-auth.routes';
import chatRoutes from './chat.routes';
import referralRoutes from './referral.routes';
import pswRoutes from './psw.routes';
import adminRoutes from './admin.routes';
import communicationRoutes from './communication.routes';

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

/** Mount Doctor -> PSW Referral and PSW Workspace routes */
router.use('/api/referrals', referralRoutes);
router.use('/api/psw', pswRoutes);

/** Mount Professional Communication routes (Phase 3D) */
router.use('/api/communications', communicationRoutes);

/** Mount Admin Portal & Knowledge Base API routes */
router.use('/api/admin/knowledge', adminKnowledgeRoutes);
router.use('/api/admin', adminRoutes);

/** Mount Patient and Caretaker account routes (Phase 1 — DearPal Care) */
router.use('/api/patient', patientAuthRoutes);
router.use('/api/caretaker', caretakerAuthRoutes);

/** Mount Chat Bridge routes (Phase 2 — DearPal Care) */
router.use('/api/chat', chatRoutes);

export default router;
