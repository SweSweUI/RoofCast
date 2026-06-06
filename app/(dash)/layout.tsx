import { AppShell } from '@/components/AppShell';
import { Suspense } from 'react';
import { getSessionUser } from '@/lib/supabase/server';
import { SettingsProvider } from '@/lib/client/settings';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading dashboard…</div>}>
      <SettingsProvider>
        <AppShell user={user}>{children}</AppShell>
      </SettingsProvider>
    </Suspense>
  );
}
