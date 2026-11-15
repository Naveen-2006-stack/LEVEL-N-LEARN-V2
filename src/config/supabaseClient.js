import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  process.env.VITE_SUPABASE_URL || 
  'https://pyevwribnexxousrdqri.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) || 
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZXZ3cmlibmV4eG91c3JkcXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNDA4NjQsImV4cCI6MjEwMTgxNjg2NH0.ywSqQ9xyQ9vgLSxBTUnUdddOC7gb7UXFS9kCjKm8SI4';

/**
 * Official Supabase Client configured for client-side Auth & Password Recovery.
 * Enables automatic token detection in URL hash / query parameters for recovery flows.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export default supabase;
