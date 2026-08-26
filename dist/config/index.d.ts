/**
 * Application Configuration
 *
 * Centralizes all environment variables and validates
 * that required values are present at startup.
 * Fails fast with clear error messages for missing config.
 */
/** Application configuration object */
export declare const config: {
    /** Server configuration */
    readonly server: {
        readonly port: number;
        readonly nodeEnv: string;
        readonly isProduction: boolean;
    };
    /** WhatsApp Cloud API configuration */
    readonly whatsapp: {
        readonly accessToken: string;
        readonly verifyToken: string;
        readonly phoneNumberId: string;
        readonly apiVersion: string;
        /** Base URL for the WhatsApp Cloud API */
        readonly apiBaseUrl: string;
    };
    /** Logging configuration */
    readonly logging: {
        readonly level: string;
    };
    /** Rate limiting configuration */
    readonly rateLimit: {
        readonly windowMs: number;
        readonly maxRequests: number;
    };
    /** Supabase configuration */
    readonly supabase: {
        readonly url: string;
        readonly serviceRoleKey: string;
        readonly anonKey: string;
    };
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
    readonly security: {
        readonly caretakerCodePepper: string;
        readonly caretakerCodeEncryptionKey: string;
        readonly otpPepper: string;
        readonly otpProvider: string;
    };
    /** File paths */
    readonly paths: {
        readonly temp: "temp";
        readonly logs: "logs";
    };
};
export type AppConfig = typeof config;
//# sourceMappingURL=index.d.ts.map