'use client';
import { useState } from 'react';
import { useApi } from '@/lib/client/hooks';
import { ROLE_LABEL, type Role } from '@/lib/rbac';
import { Card, LoadingBlock, Pill, SectionTitle, Td, Th } from '@/components/ui';
import { dateShort, num } from '@/lib/format';

interface ProfileRow { email: string; role: string; full_name: string; created_at: string }

export default function AdminPage() {
  const users = useApi<{ users: ProfileRow[] }>('/api/admin/users');
  const inv = useApi<any>('/api/inventory');
  const [confirm, setConfirm] = useState('');
  const [purging, setPurging] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function purge() {
    setPurging(true);
    setResult(null);
    const r = await fetch('/api/admin/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm }),
    });
    const body = await r.json();
    setResult(r.ok ? `✅ ${body.message}` : `⚠ ${body.error}`);
    setPurging(false);
    setConfirm('');
  }

  const inventory = inv.data?.inventory;

  return (
    <div className="space-y-5">
      <SectionTitle sub="User accounts, data footprint and hackathon data governance">
        Admin — Access & Data Governance
      </SectionTitle>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-900">Data-handling reminder</h2>
        <p className="mt-1 text-sm text-amber-800">
          Altis data is anonymised and for the hackathon only. <strong>Copies must be deleted within
          3 days after the event.</strong> Local data lives in <code>data/</code> (gitignored); cloud
          data lives in the Supabase project under <code>altis_*</code> tables. The Supabase personal
          access token shared for this build should be rotated afterwards.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="User accounts" subtitle="Supabase Auth · roles from altis_profiles">
          {users.loading && !users.data ? (
            <LoadingBlock />
          ) : users.error ? (
            <p className="text-sm text-risk-high">{users.error}</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th></tr>
              </thead>
              <tbody>
                {(users.data?.users ?? []).map((u) => (
                  <tr key={u.email}>
                    <Td>{u.full_name}</Td>
                    <Td className="text-2xs">{u.email}</Td>
                    <Td><Pill tone="accent">{ROLE_LABEL[(u.role as Role)] ?? u.role}</Pill></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Data footprint" subtitle="What is loaded right now">
          {inventory ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Source files" value={num(inventory.files_loaded)} />
              <Stat label="Rows loaded" value={num(inventory.rows_loaded)} />
              <Stat label="Companies" value={num(inventory.companies?.length)} />
              <Stat label="Duplicate rows removed" value={num(inventory.duplicate_rows_removed)} />
              <Stat label="Generated" value={inventory.generated_at ? dateShort(inventory.generated_at) : '–'} />
              <Stat label="Backend" value="Supabase (altis_*)" />
            </dl>
          ) : (
            <LoadingBlock />
          )}
        </Card>
      </div>

      <Card title="Purge portfolio data" subtitle="Clears all altis_* portfolio data from Supabase (schema & user accounts remain)">
        <p className="text-sm text-ink-muted">
          This removes every transaction, weekly aggregate, weather row and forecast from the cloud
          backend — used to satisfy the 3-day deletion requirement. User accounts and the schema are
          kept (re-seed with the pipeline). For a <strong>full teardown</strong> (drop all{' '}
          <code>altis_*</code> objects + delete the demo users), run <code>scripts/purge.sh</code> from
          the CLI.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="rounded-md border border-panel-line bg-panel px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-risk-high/40"
          />
          <button
            onClick={purge}
            disabled={purging || confirm !== 'DELETE'}
            className="rounded-md bg-risk-high px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-40"
          >
            {purging ? 'Purging…' : 'Purge portfolio data'}
          </button>
        </div>
        {result && <p className="mt-3 rounded-md bg-panel-sunken p-3 text-2xs text-ink-soft">{result}</p>}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-panel-line bg-panel-sunken px-3 py-2">
      <dt className="text-2xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tnum text-ink">{value}</dd>
    </div>
  );
}
