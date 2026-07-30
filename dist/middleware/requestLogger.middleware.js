"use strict";
/**
 * Request Logger Middleware
 *
 * Logs every incoming HTTP request with method, URL,
 * status code, and response time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggerMiddleware = requestLoggerMiddleware;
const logger_1 = require("../utils/logger");
/**
 * Logs request details and response time for every HTTP request.
 */
function requestLoggerMiddleware(req, res, next) {
    const startTime = Date.now();
    // Log when the response finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTimeMs: duration,
            contentLength: res.get('Content-Length') || 0,
            userAgent: req.get('User-Agent') || 'unknown',
            ip: req.ip,
        };
        // Use appropriate log level based on status code
        if (res.statusCode >= 500) {
            logger_1.logger.error('Request completed with server error', logData);
        }
        else if (res.statusCode >= 400) {
            logger_1.logger.warn('Request completed with client error', logData);
        }
        else {
            logger_1.logger.info('Request completed', logData);
        }
    });
    next();
}
//# sourceMappingURL=requestLogger.middleware.js.map