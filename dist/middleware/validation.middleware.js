"use strict";
/**
 * Validation Middleware
 *
 * Validates webhook query parameters (GET) and
 * request body structure (POST) before they reach controllers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWebhookQuery = validateWebhookQuery;
exports.validateWebhookBody = validateWebhookBody;
const logger_1 = require("../utils/logger");
/**
 * Validates GET /webhook query parameters for Meta webhook verification.
 * Required params: hub.mode, hub.verify_token, hub.challenge
 */
function validateWebhookQuery(req, res, next) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (!mode || !token || !challenge) {
        logger_1.logger.warn('Webhook verification missing required query parameters', {
            hasMode: !!mode,
            hasToken: !!token,
            hasChallenge: !!challenge,
        });
        res.status(400).json({
            status: 'error',
            message: 'Missing required query parameters: hub.mode, hub.verify_token, hub.challenge',
        });
        return;
    }
    next();
}
/**
 * Validates POST /webhook request body has the expected WhatsApp structure.
 */
function validateWebhookBody(req, res, next) {
    const body = req.body;
    if (!body || typeof body !== 'object') {
        logger_1.logger.warn('Webhook received empty or invalid body');
        res.status(400).json({
            status: 'error',
            message: 'Request body is required',
        });
        return;
    }
    if (body.object !== 'whatsapp_business_account') {
        logger_1.logger.warn('Webhook received non-WhatsApp payload', { object: body.object });
        res.status(400).json({
            status: 'error',
            message: 'Invalid webhook payload: expected whatsapp_business_account',
        });
        return;
    }
    if (!Array.isArray(body.entry) || body.entry.length === 0) {
        logger_1.logger.warn('Webhook received payload with missing or empty entry array');
        res.status(400).json({
            status: 'error',
            message: 'Invalid webhook payload: missing entry array',
        });
        return;
    }
    next();
}
//# sourceMappingURL=validation.middleware.js.map