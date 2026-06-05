'use client';
import { createBrowserClient } from '@supabase/ssr';

/** Browser client — for the login page (sign in / sign out). */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
