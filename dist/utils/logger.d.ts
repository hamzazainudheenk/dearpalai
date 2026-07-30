/**
 * Winston Logger
 *
 * Structured logging with console and file transports.
 * JSON format in production, colorized in development.
 * Logs to logs/error.log and logs/combined.log.
 */
import winston from 'winston';
/**
 * Application logger instance.
 *
 * Usage:
 *   logger.info('Server started', { port: 3000 });
 *   logger.error('Failed to process', { error: err.message });
 */
export declare const logger: winston.Logger;
//# sourceMappingURL=logger.d.ts.map