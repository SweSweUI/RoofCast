import { AppShell } from '@/components/AppShell';
import { Suspense } from 'react';
import { getSessionUser } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading dashboard…</div>}>
      <AppShell user={user}>{children}</AppShell>
    </Suspense>
  );
}
