/**
 * Global Error Handling Middleware
 *
 * Catches all unhandled errors and returns structured JSON responses.
 * Handles specific error types with appropriate HTTP status codes.
 */
import { Request, Response, NextFunction } from 'express';
/** Custom application error with HTTP status code */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    /** Machine-readable error code, e.g. 'INVALID_CARETAKER_CODE'. Optional —
     *  existing call sites that don't pass one are unaffected. */
    readonly code?: string;
    constructor(message: string, statusCode: number, isOperational?: boolean, code?: string);
}
/** Specific error types for common failure scenarios */
export declare class MediaExpiredError extends AppError {
    constructor(mediaId: string);
}
export declare class InvalidTokenError extends AppError {
    constructor();
}
export declare class NetworkTimeoutError extends AppError {
    constructor(url: string);
}
export declare class ValidationError extends AppError {
    constructor(message: string);
}
/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain.
 */
export declare function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=error.middleware.d.ts.map