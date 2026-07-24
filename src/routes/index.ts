/**
 * Route Aggregator
 *
 * Mounts all route groups and provides a health check endpoint.
 */

import { Router, Request, Response } from 'express';
import webhookRoutes from './webhook.routes';

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

/** Mount webhook routes at /webhook */
router.use('/webhook', webhookRoutes);

export default router;
