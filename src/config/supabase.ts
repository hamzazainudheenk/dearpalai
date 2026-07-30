import { createClient } from '@supabase/supabase-js';
import { config } from './index';
import { logger } from '@utils/logger';

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  logger.warn('Supabase URL or Service Role Key is missing. Supabase functionality will be disabled until configured.');
}

/**
 * Backend Supabase client initialized with the Service Role key.
 * This client bypasses Row Level Security (RLS) to perform administrative
 * operations like inserting WhatsApp webhook messages into the database.
 */
export const supabaseAdmin = createClient(
  config.supabase.url || 'https://placeholder.supabase.co',
  config.supabase.serviceRoleKey || 'placeholder_key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
