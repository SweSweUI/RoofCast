import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Server client bound to the request cookies — for reading the auth session
 *  in server components / route handlers. */
export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — middleware refreshes the session
          }
        },
      },
    },
  );
}

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

/** Current user + role (role read from user_metadata, set at account creation).
 *  Returns null when Supabase isn't configured (local SQLite-only mode). */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  const supabase = createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const m = (data.user.user_metadata ?? {}) as { role?: string; full_name?: string };
  return {
    id: data.user.id,
    email: data.user.email ?? '',
    role: m.role ?? 'project',
    fullName: m.full_name ?? data.user.email ?? '',
  };
}
