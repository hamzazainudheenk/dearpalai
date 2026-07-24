/**
 * Server Entry Point
 *
 * Creates required directories, starts the Express server,
 * and handles graceful shutdown on SIGTERM/SIGINT.
 */

import fs from 'fs';
import path from 'path';
import app from './app';
import { config } from '@config/index';
import { logger } from '@utils/logger';

// ─── Create Required Directories ─────────────────────────

const directories = [
  path.join(process.cwd(), config.paths.temp),
  path.join(process.cwd(), config.paths.logs),
];

for (const dir of directories) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
}

// ─── Start Server ────────────────────────────────────────

const server = app.listen(config.server.port, () => {
  logger.info('🚀 DearPal WhatsApp Service started', {
    port: config.server.port,
    environment: config.server.nodeEnv,
    apiVersion: config.whatsapp.apiVersion,
  });
  logger.info(`Health check: http://localhost:${config.server.port}/health`);
  logger.info(`Webhook URL:  http://localhost:${config.server.port}/webhook`);
});

// ─── Graceful Shutdown ───────────────────────────────────

function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

export default server;
