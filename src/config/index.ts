/**
 * Application Configuration
 *
 * Centralizes all environment variables and validates
 * that required values are present at startup.
 * Fails fast with clear error messages for missing config.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local or .env file
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

/**
 * Validates that a required environment variable is set.
 * Throws a descriptive error if missing.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[Config] Missing required environment variable: ${key}. ` +
        `Please set it in your .env file. See .env.example for reference.`,
    );
  }
  return value;
}

/**
 * Returns an environment variable or a default value.
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/** Application configuration object */
export const config = {
  /** Server configuration */
  server: {
    port: parseInt(optionalEnv('PORT', '3000'), 10),
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
  },

  /** WhatsApp Cloud API configuration */
  whatsapp: {
    accessToken: requireEnv('META_ACCESS_TOKEN'),
    verifyToken: requireEnv('VERIFY_TOKEN'),
    phoneNumberId: requireEnv('PHONE_NUMBER_ID'),
    apiVersion: optionalEnv('WHATSAPP_API_VERSION', 'v23.0'),
    /** Base URL for the WhatsApp Cloud API */
    get apiBaseUrl(): string {
      return `https://graph.facebook.com/${this.apiVersion}`;
    },
  },

  /** Logging configuration */
  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
  },

  /** Rate limiting configuration */
  rateLimit: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 minutes
    maxRequests: parseInt(optionalEnv('RATE_LIMIT_MAX', '100'), 10),
  },

  /** Supabase configuration */
  supabase: {
    url: optionalEnv('SUPABASE_URL', ''),
    serviceRoleKey: optionalEnv('SUPABASE_SERVICE_ROLE_KEY', ''),
    anonKey: optionalEnv('SUPABASE_ANON_KEY', ''),
  },

  /**
   * Patient/Caretaker account security (Phase 1).
   *
   * `caretakerCodePepper` / `otpPepper` are server-side secrets mixed into
   * the HMAC used to hash caretaker codes and OTPs at rest — never store
   * either value in the database, only a keyed hash of it. Falls back to a
   * dev-only default with a startup warning (see `utils/crypto.ts`); set a
   * real value in production.
   *
   * `otpProvider` selects the caretaker OTP delivery mechanism:
   *   - 'mock': development/demo only — no real SMS is sent. Refused at
   *     startup if NODE_ENV=production (see `services/otp/otp-provider.ts`).
   *   - anything else (default): no SMS provider is configured; OTP send
   *     fails loudly with a clear error rather than silently faking one.
   */
  security: {
    caretakerCodePepper: optionalEnv('CARETAKER_CODE_PEPPER', ''),
    caretakerCodeEncryptionKey: optionalEnv('CARETAKER_CODE_ENCRYPTION_KEY', ''),
    otpPepper: optionalEnv('OTP_PEPPER', ''),
    otpProvider: optionalEnv('OTP_PROVIDER', 'none'),
  },

  /** File paths */
  paths: {
    temp: 'temp',
    logs: 'logs',
  },
} as const;

export type AppConfig = typeof config;
