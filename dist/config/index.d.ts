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
    /** File paths */
    readonly paths: {
        readonly temp: "temp";
        readonly logs: "logs";
    };
};
export type AppConfig = typeof config;
//# sourceMappingURL=index.d.ts.map