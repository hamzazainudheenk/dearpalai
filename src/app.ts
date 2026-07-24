/**
 * Express Application Setup
 *
 * Configures the Express app with all middleware, routes,
 * and error handling. Exports the app for use by server.ts.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '@config/index';
import { requestLoggerMiddleware } from '@middleware/requestLogger.middleware';
import { errorMiddleware } from '@middleware/error.middleware';
import routes from '@routes/index';

const app = express();

// ─── Security Middleware ─────────────────────────────────

/** Helmet: Sets various HTTP headers for security */
app.use(helmet());

/** CORS: Enable Cross-Origin Resource Sharing */
app.use(cors());

/** Rate Limiting: Prevent brute-force and DDoS */
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Too many requests, please try again later.',
    },
  }),
);

// ─── Body Parsing ────────────────────────────────────────

/** Parse JSON request bodies */
app.use(express.json());

/** Parse URL-encoded request bodies */
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────────

/** Log every incoming request with response time */
app.use(requestLoggerMiddleware);

// ─── Routes ──────────────────────────────────────────────

/** Mount all application routes */
app.use('/', routes);

// ─── Error Handling ──────────────────────────────────────

/** Global error handler — must be registered LAST */
app.use(errorMiddleware);

export default app;
