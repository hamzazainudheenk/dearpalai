"use strict";
/**
 * Server Entry Point
 *
 * Creates required directories, starts the Express server,
 * and handles graceful shutdown on SIGTERM/SIGINT.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const app_1 = __importDefault(require("./app"));
const index_1 = require("./config/index");
const logger_1 = require("./utils/logger");
// ─── Create Required Directories ─────────────────────────
const directories = [
    path_1.default.join(process.cwd(), index_1.config.paths.temp),
    path_1.default.join(process.cwd(), index_1.config.paths.logs),
];
for (const dir of directories) {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
        logger_1.logger.info(`Created directory: ${dir}`);
    }
}
// ─── Start Server ────────────────────────────────────────
const server = app_1.default.listen(index_1.config.server.port, () => {
    logger_1.logger.info('🚀 DearPal WhatsApp Service started', {
        port: index_1.config.server.port,
        environment: index_1.config.server.nodeEnv,
        apiVersion: index_1.config.whatsapp.apiVersion,
    });
    logger_1.logger.info(`Health check: http://localhost:${index_1.config.server.port}/health`);
    logger_1.logger.info(`Webhook URL:  http://localhost:${index_1.config.server.port}/webhook`);
});
// ─── Graceful Shutdown ───────────────────────────────────
function gracefulShutdown(signal) {
    logger_1.logger.info(`${signal} received. Starting graceful shutdown...`);
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
        process.exit(0);
    });
    // Force shutdown after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
        logger_1.logger.error('Graceful shutdown timed out, forcing exit');
        process.exit(1);
    }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error('Unhandled rejection', { reason });
    process.exit(1);
});
exports.default = server;
//# sourceMappingURL=server.js.map