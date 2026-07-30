"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const index_1 = require("./index");
const logger_1 = require("../utils/logger");
if (!index_1.config.supabase.url || !index_1.config.supabase.serviceRoleKey) {
    logger_1.logger.warn('Supabase URL or Service Role Key is missing. Supabase functionality will be disabled until configured.');
}
/**
 * Backend Supabase client initialized with the Service Role key.
 * This client bypasses Row Level Security (RLS) to perform administrative
 * operations like inserting WhatsApp webhook messages into the database.
 */
exports.supabaseAdmin = (0, supabase_js_1.createClient)(index_1.config.supabase.url || 'https://placeholder.supabase.co', index_1.config.supabase.serviceRoleKey || 'placeholder_key', {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});
//# sourceMappingURL=supabase.js.map