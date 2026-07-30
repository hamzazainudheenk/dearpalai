/**
 * Request Logger Middleware
 *
 * Logs every incoming HTTP request with method, URL,
 * status code, and response time.
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Logs request details and response time for every HTTP request.
 */
export declare function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=requestLogger.middleware.d.ts.map