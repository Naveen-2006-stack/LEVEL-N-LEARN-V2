import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

let supabaseClient = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return supabaseClient;
}

export const supabase = getSupabaseClient();
