"use strict";
/**
 * Global Error Handling Middleware
 *
 * Catches all unhandled errors and returns structured JSON responses.
 * Handles specific error types with appropriate HTTP status codes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.NetworkTimeoutError = exports.InvalidTokenError = exports.MediaExpiredError = exports.AppError = void 0;
exports.errorMiddleware = errorMiddleware;
const logger_1 = require("../utils/logger");
/** Custom application error with HTTP status code */
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
/** Specific error types for common failure scenarios */
class MediaExpiredError extends AppError {
    constructor(mediaId) {
        super(`Media URL expired for media ID: ${mediaId}`, 410);
    }
}
exports.MediaExpiredError = MediaExpiredError;
class InvalidTokenError extends AppError {
    constructor() {
        super('Invalid or expired access token', 401);
    }
}
exports.InvalidTokenError = InvalidTokenError;
class NetworkTimeoutError extends AppError {
    constructor(url) {
        super(`Network timeout while connecting to: ${url}`, 504);
    }
}
exports.NetworkTimeoutError = NetworkTimeoutError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}
exports.ValidationError = ValidationError;
/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain.
 */
function errorMiddleware(err, _req, res, _next) {
    // Determine status code and operational flag
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const isOperational = err instanceof AppError ? err.isOperational : false;
    // Log the error
    logger_1.logger.error('Unhandled error', {
        message: err.message,
        statusCode,
        isOperational,
        stack: err.stack,
    });
    // Send structured response
    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message: isOperational ? err.message : 'An unexpected error occurred',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}
//# sourceMappingURL=error.middleware.js.map