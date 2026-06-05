import { getSessionUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('altis_profiles')
    .select('email, role, full_name, created_at')
    .order('role');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ users: data ?? [] });
}
