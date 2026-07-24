/**
 * Global Error Handling Middleware
 *
 * Catches all unhandled errors and returns structured JSON responses.
 * Handles specific error types with appropriate HTTP status codes.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

/** Custom application error with HTTP status code */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** Specific error types for common failure scenarios */
export class MediaExpiredError extends AppError {
  constructor(mediaId: string) {
    super(`Media URL expired for media ID: ${mediaId}`, 410);
  }
}

export class InvalidTokenError extends AppError {
  constructor() {
    super('Invalid or expired access token', 401);
  }
}

export class NetworkTimeoutError extends AppError {
  constructor(url: string) {
    super(`Network timeout while connecting to: ${url}`, 504);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain.
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Determine status code and operational flag
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  // Log the error
  logger.error('Unhandled error', {
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
