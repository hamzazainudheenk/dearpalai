"use strict";
/**
 * Express Application Setup
 *
 * Configures the Express app with all middleware, routes,
 * and error handling. Exports the app for use by server.ts.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const index_1 = require("./config/index");
const requestLogger_middleware_1 = require("./middleware/requestLogger.middleware");
const error_middleware_1 = require("./middleware/error.middleware");
const index_2 = __importDefault(require("./routes/index"));
const app = (0, express_1.default)();
// ─── Security Middleware ─────────────────────────────────
/** Helmet: Sets various HTTP headers for security */
app.use((0, helmet_1.default)());
/** CORS: Enable Cross-Origin Resource Sharing */
app.use((0, cors_1.default)());
/** Rate Limiting: Prevent brute-force and DDoS */
app.use((0, express_rate_limit_1.default)({
    windowMs: index_1.config.rateLimit.windowMs,
    max: index_1.config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'Too many requests, please try again later.',
    },
}));
// ─── Body Parsing ────────────────────────────────────────
/** Parse JSON request bodies */
app.use(express_1.default.json());
/** Parse URL-encoded request bodies */
app.use(express_1.default.urlencoded({ extended: true }));
// ─── Logging ─────────────────────────────────────────────
/** Log every incoming request with response time */
app.use(requestLogger_middleware_1.requestLoggerMiddleware);
// ─── Routes ──────────────────────────────────────────────
/** Mount all application routes */
app.use('/', index_2.default);
// ─── Error Handling ──────────────────────────────────────
/** Global error handler — must be registered LAST */
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
//# sourceMappingURL=app.js.map