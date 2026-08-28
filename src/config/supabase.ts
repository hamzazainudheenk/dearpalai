import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './index';
import { logger } from '@utils/logger';

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  logger.warn('Supabase URL or Service Role Key is missing. Supabase functionality will be disabled until configured.');
}

/**
 * Backend Supabase administrative client initialized with the Service Role key.
 * This client bypasses Row Level Security (RLS) to perform administrative
 * operations like inserting records, managing users, and reading system data.
 *
 * NOTE: Never call auth.signIn / auth.verifyOtp directly on this client, as that
 * mutates the client instance session. Use `createEphemeralAuthClient()` instead.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabase.url || 'https://placeholder.supabase.co',
  config.supabase.serviceRoleKey || 'placeholder_key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${config.supabase.serviceRoleKey || 'placeholder_key'}`,
        apikey: config.supabase.serviceRoleKey || 'placeholder_key',
      },
    },
  }
);

/**
 * Creates an ephemeral Supabase client instance for interactive auth operations
 * (e.g. redeeming magic links or verifying email OTPs) so that the user session
 * does NOT mutate or pollute the global `supabaseAdmin` service role instance.
 */
export function createEphemeralAuthClient(): SupabaseClient {
  return createClient(
    config.supabase.url || 'https://placeholder.supabase.co',
    config.supabase.serviceRoleKey || 'placeholder_key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
