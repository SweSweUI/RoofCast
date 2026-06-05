import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client — SERVER ONLY. Bypasses RLS, used for server-side data
 * reads (the dashboard data is internal portfolio analytics) and admin actions.
 * Never import this into a client component.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
