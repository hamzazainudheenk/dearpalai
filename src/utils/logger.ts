/**
 * Winston Logger
 *
 * Structured logging with console and file transports.
 * JSON format in production, colorized in development.
 * Logs to logs/error.log and logs/combined.log.
 */

import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

/** Custom format for development console output */
const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${message}${metaStr}`;
});

/** Determine log level from environment */
const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';
const logsDir = path.join(process.cwd(), 'logs');

/**
 * Application logger instance.
 *
 * Usage:
 *   logger.info('Server started', { port: 3000 });
 *   logger.error('Failed to process', { error: err.message });
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
  ),
  defaultMeta: { service: 'dearpal-whatsapp' },
  transports: [
    // Console transport — colorized in dev, JSON in prod
    new winston.transports.Console({
      format: isProduction ? combine(json()) : combine(colorize(), devFormat),
    }),

    // File transport — error level only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: combine(json()),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),

    // File transport — all levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: combine(json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],

  // Don't exit on unhandled errors
  exitOnError: false,
});
