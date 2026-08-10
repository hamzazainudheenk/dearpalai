"use strict";
/**
 * Route Aggregator
 *
 * Mounts all route groups and provides a health check endpoint.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_routes_1 = __importDefault(require("./webhook.routes"));
const patient_routes_1 = __importDefault(require("./patient.routes"));
const session_routes_1 = __importDefault(require("./session.routes"));
const conversation_routes_1 = __importDefault(require("./conversation.routes"));
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const admin_knowledge_routes_1 = __importDefault(require("./admin-knowledge.routes"));
const router = (0, express_1.Router)();
/**
 * GET /health
 * Health check endpoint for load balancers and monitoring.
 */
router.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'dearpal-whatsapp',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
/** Mount WhatsApp webhook routes at /webhook */
router.use('/webhook', webhook_routes_1.default);
/** Mount REST API routes for DearPal Frontend */
router.use('/api/patients', patient_routes_1.default);
router.use('/api/patients/:id/sessions', session_routes_1.default);
router.use('/api/patients/:id/conversations', conversation_routes_1.default);
router.use('/api/dashboard', dashboard_routes_1.default);
/** Mount Admin Knowledge Base API routes */
router.use('/api/admin/knowledge', admin_knowledge_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map