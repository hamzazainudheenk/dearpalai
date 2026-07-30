"use strict";
/**
 * Winston Logger
 *
 * Structured logging with console and file transports.
 * JSON format in production, colorized in development.
 * Logs to logs/error.log and logs/combined.log.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const { combine, timestamp, printf, colorize, json, errors } = winston_1.default.format;
/** Custom format for development console output */
const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}]: ${message}${metaStr}`;
});
/** Determine log level from environment */
const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';
const logsDir = path_1.default.join(process.cwd(), 'logs');
/**
 * Application logger instance.
 *
 * Usage:
 *   logger.info('Server started', { port: 3000 });
 *   logger.error('Failed to process', { error: err.message });
 */
exports.logger = winston_1.default.createLogger({
    level: logLevel,
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), errors({ stack: true })),
    defaultMeta: { service: 'dearpal-whatsapp' },
    transports: [
        // Console transport — colorized in dev, JSON in prod
        new winston_1.default.transports.Console({
            format: isProduction ? combine(json()) : combine(colorize(), devFormat),
        }),
        // File transport — error level only
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'error.log'),
            level: 'error',
            format: combine(json()),
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 5,
        }),
        // File transport — all levels
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'combined.log'),
            format: combine(json()),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
        }),
    ],
    // Don't exit on unhandled errors
    exitOnError: false,
});
//# sourceMappingURL=logger.js.map