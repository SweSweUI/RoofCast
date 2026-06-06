'use client';

import { useState } from 'react';
import { useApi } from '@/lib/client/hooks';
import type { AccountingConnector, ConnectorStatus } from '@/lib/connectors';
import { Card, LoadingBlock, Pill, SectionTitle, Td, Th } from '@/components/ui';

interface ConnectorsResponse {
  connectors: AccountingConnector[];
  sourceFileCount: number;
  note: string;
}

const STATUS_LABEL: Record<ConnectorStatus, string> = {
  file_import_active: 'File import active',
  ready_for_setup: 'Ready for setup',
  not_configured: 'Not configured',
  connected: 'Connected',
  sync_failed: 'Sync failed',
};

const STATUS_CLASS: Record<ConnectorStatus, string> = {
  file_import_active: 'bg-teal-50 text-accent ring-accent/20',
  ready_for_setup: 'bg-amber-50 text-risk-medium ring-amber-600/20',
  not_configured: 'bg-slate-100 text-ink-muted ring-panel-line',
  connected: 'bg-green-50 text-risk-low ring-green-600/20',
  sync_failed: 'bg-red-50 text-risk-high ring-red-600/20',
};

export default function ConnectorsPage() {
  const { data, loading, error } = useApi<ConnectorsResponse>('/api/connectors');
  const [setup, setSetup] = useState<Record<string, string>>({});

  async function prepare(id: string) {
    setSetup((prev) => ({ ...prev, [id]: 'Preparing...' }));
    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`);
      setSetup((prev) => ({ ...prev, [id]: body.message ?? body.nextAction }));
    } catch (e) {
      setSetup((prev) => ({ ...prev, [id]: String(e) }));
    }
  }

  if (error) {
    return (
      <Card title="Connector status unavailable">
        <p className="text-sm text-ink-muted">{error}</p>
      </Card>
    );
  }
  if (!data && loading) return <LoadingBlock label="Loading accounting connectors..." />;
  if (!data) return null;

  const active = data.connectors.filter((connector) => connector.status === 'file_import_active' || connector.status === 'connected');
  const ready = data.connectors.filter((connector) => connector.status === 'ready_for_setup').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle sub={`${data.sourceFileCount} source files currently loaded · credentials never leave the server side`}>
          API - Accounting Connectors
        </SectionTitle>
        <Pill tone="accent">manual import stays as fallback</Pill>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Current coverage">
          <div className="text-2xl font-semibold text-ink">{active.length}</div>
          <p className="mt-1 text-2xs text-ink-muted">systems represented by current exports/imports</p>
        </Card>
        <Card title="Ready for live setup">
          <div className="text-2xl font-semibold text-risk-medium">{ready}</div>
          <p className="mt-1 text-2xs text-ink-muted">connectors with server-side setup path</p>
        </Card>
        <Card title="Credential policy">
          <div className="text-sm font-medium text-ink">Server-side only</div>
          <p className="mt-1 text-2xs text-ink-muted">{data.note}</p>
        </Card>
      </div>

      <Card
        title="Connector registry"
        subtitle="Exact, SnelStart, Gilde/import, and major accounting platforms. Status reflects safe metadata only."
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {data.connectors.map((connector) => (
            <div key={connector.id} className="rounded-md border border-panel-line bg-panel p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{connector.name}</h2>
                  <p className="mt-0.5 text-2xs text-ink-muted">{connector.platform} · {connector.authType}</p>
                </div>
                <StatusPill status={connector.status} />
              </div>
              <p className="mt-2 text-xs text-ink-soft">{connector.currentSource}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {connector.dataScope.map((scope) => (
                  <span key={scope} className="rounded bg-panel-sunken px-1.5 py-0.5 text-[10px] text-ink-muted">{scope}</span>
                ))}
              </div>
              <p className="mt-2 text-2xs text-ink-faint">{connector.safeMetadata}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => prepare(connector.id)}
                  className="rounded-md border border-panel-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-panel-sunken"
                >
                  Prepare setup
                </button>
                <span className="text-2xs text-ink-faint">
                  {connector.lastSyncedAt ? 'metadata refreshed this run' : 'no live sync yet'}
                </span>
              </div>
              {setup[connector.id] && (
                <p className="mt-2 rounded bg-panel-sunken px-2 py-1.5 text-2xs text-ink-muted">{setup[connector.id]}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Production sync contract" subtitle="What each live connector must write into the existing Altis model">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <Th>Layer</Th>
                <Th>Expected data</Th>
                <Th>Current fallback</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>Identity</Td>
                <Td>Company/admin id, source system, ledger/account ids</Td>
                <Td>companies + accounts from Excel exports</Td>
              </tr>
              <tr>
                <Td>Revenue and invoices</Td>
                <Td>Sales invoices, GL revenue rows, invoice dates, customer terms</Td>
                <Td>transactions + weekly_financials</Td>
              </tr>
              <tr>
                <Td>Cash conversion</Td>
                <Td>Payments, debtor aging, bank receipts</Td>
                <Td>payment-lag assumptions until bank/debtor data connects</Td>
              </tr>
              <tr>
                <Td>Cost/AP</Td>
                <Td>AP ledger, payroll, subcontractor and material payments</Td>
                <Td>cash-out driver assumptions</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatusPill({ status }: { status: ConnectorStatus }) {
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-2xs font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
