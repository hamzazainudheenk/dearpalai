/**
 * Webhook Routes
 *
 * Defines the GET and POST /webhook endpoints with
 * appropriate validation middleware.
 */

import { Router } from 'express';
import { container } from '../container';
import { validateWebhookQuery, validateWebhookBody } from '@middleware/validation.middleware';

const router = Router();
const controller = container.webhookController;

/**
 * GET /webhook
 * Meta webhook verification endpoint.
 * Validates query params before reaching the controller.
 */
router.get('/', validateWebhookQuery, controller.verifyWebhook);

/**
 * POST /webhook
 * Receives incoming WhatsApp messages.
 * Validates body structure before reaching the controller.
 */
router.post('/', validateWebhookBody, controller.handleWebhook);

export default router;
