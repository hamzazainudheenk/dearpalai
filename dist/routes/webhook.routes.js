"use strict";
/**
 * Webhook Routes
 *
 * Defines the GET and POST /webhook endpoints with
 * appropriate validation middleware.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const container_1 = require("../container");
const validation_middleware_1 = require("../middleware/validation.middleware");
const router = (0, express_1.Router)();
const controller = container_1.container.webhookController;
/**
 * GET /webhook
 * Meta webhook verification endpoint.
 * Validates query params before reaching the controller.
 */
router.get('/', validation_middleware_1.validateWebhookQuery, controller.verifyWebhook);
/**
 * POST /webhook
 * Receives incoming WhatsApp messages.
 * Validates body structure before reaching the controller.
 */
router.post('/', validation_middleware_1.validateWebhookBody, controller.handleWebhook);
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map