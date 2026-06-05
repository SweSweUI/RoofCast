'use client';

import { useApi } from '@/lib/client/hooks';
import { eur, eurCompact, num, dateShort } from '@/lib/format';
import {
  Card,
  Kpi,
  Pill,
  AssumptionTag,
  SectionTitle,
  LoadingBlock,
  Th,
  Td,
} from '@/components/ui';

// ─── API shape ───────────────────────────────────────────────────────────────

interface Company {
  name: string;
  system: string;
  confidence: string;
  transactions: number;
  date_min: string;
  date_max: string;
  net_revenue_total: number;
}

interface ReconciliationRow {
  company_id: number;
  year: string;
  weekly_credit_total: number;
  monthly_summary_netto: number | null;
}

interface InventoryData {
  generated_at: string;
  files_loaded: number;
  rows_loaded: number;
  duplicate_rows_removed: number;
  companies: Company[];
  accounts_detected: number;
  assumptions_created: number;
  covenants_configured: number;
  missing_fields: string[];
  reconciliation: ReconciliationRow[];
}

interface SourceFile {
  filename: string;
  source_group: string;
  sheet_name: string;
  file_type: string;
  row_count: number;
  detected_company: string;
  detected_system: string;
  notes: string;
}

interface Account {
  company: string;
  code: string;
  name: string;
  category: string;
  confidence: string;
  method: string;
  txns: number;
}

interface Assumption {
  id: number;
  key: string;
  scope: string;
  category: string;
  valueNum: number | null;
  valueText: string | null;
  unit: string | null;
  rationale: string;
  source: string;
}

interface Covenant {
  id: number;
  companyId: number | null;
  name: string;
  metric: string;
  threshold: number;
  direction: string;
  unit: string;
  basis: string;
  isAssumption: number | boolean;
}

interface InventoryResponse {
  inventory: InventoryData;
  files: SourceFile[];
  accounts: Account[];
  assumptions: Assumption[];
  covenants: Covenant[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidencePill(confidence: string) {
  const tone =
    confidence === 'high' ? 'accent' : confidence === 'medium' ? 'neutral' : 'muted';
  return <Pill tone={tone}>{confidence}</Pill>;
}

function assumptionValue(a: Assumption): string {
  if (a.valueNum != null) {
    const pctUnits = ['share_of_revenue', 'share'];
    if (a.unit && pctUnits.includes(a.unit)) {
      return `${(a.valueNum * 100).toFixed(0)}%`;
    }
    return `${a.valueNum}${a.unit ? ' ' + a.unit : ''}`;
  }
  return a.valueText ?? '–';
}

function reconcileVariance(weekly: number, monthly: number | null) {
  if (monthly == null) return <Pill tone="muted">no summary</Pill>;
  const variance = (weekly - monthly) / monthly;
  const pctStr = `${variance >= 0 ? '+' : ''}${(variance * 100).toFixed(1)}%`;
  if (Math.abs(variance) <= 0.05) {
    return <Pill tone="accent">{pctStr} · reconciled</Pill>;
  }
  return <Pill tone="neutral">{pctStr} · review</Pill>;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DataQualityPage() {
  const { data, error, loading } = useApi<InventoryResponse>('/api/inventory');
  // Resolve company_id → name from the source of truth, not a hardcoded map.
  const companiesApi = useApi<{ companies: { id: number; shortName: string }[] }>('/api/companies');
  const companyName = (id: number) =>
    companiesApi.data?.companies.find((c) => c.id === id)?.shortName ?? `Company ${id}`;

  if (loading && !data) return <LoadingBlock label="Loading ingestion inventory…" />;

  if (error || !data?.inventory) {
    return (
      <Card title="Data unavailable">
        <p className="text-sm text-ink-muted">
          {error ?? 'No inventory data found.'}
        </p>
        <p className="mt-2 text-2xs text-ink-faint">
          Run the pipeline: <code>npm run pipeline</code>
        </p>
      </Card>
    );
  }

  const { inventory, files, accounts, assumptions, covenants } = data;

  // ── Section 1: Header ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <SectionTitle
        sub={`Reconciled foundation from ${inventory.files_loaded} source files across 4 accounting systems · generated ${dateShort(inventory.generated_at)}`}
      >
        Data Quality &amp; Ingestion
      </SectionTitle>

      {/* Section 2: KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Files loaded" value={num(inventory.files_loaded)} />
        <Kpi label="Rows loaded" value={num(inventory.rows_loaded)} />
        <Kpi label="Companies detected" value={num(inventory.companies.length)} />
        <Kpi label="Accounts detected" value={num(inventory.accounts_detected)} />
        <Kpi
          label="Duplicate rows removed"
          value={num(inventory.duplicate_rows_removed)}
          hint="Cross-file re-exports collapsed by content hash"
          sub="cross-file de-duped"
        />
        <Kpi label="Assumptions created" value={num(inventory.assumptions_created)} />
      </div>

      {/* Section 3: Companies detected */}
      <Card
        title="Companies detected"
        subtitle={`${inventory.companies.length} entities identified across source files`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>System</Th>
                <Th>Confidence</Th>
                <Th right>Transactions</Th>
                <Th>Date range</Th>
                <Th right>Net revenue</Th>
              </tr>
            </thead>
            <tbody>
              {inventory.companies.map((c) => (
                <tr key={c.name}>
                  <Td className="font-medium text-ink">{c.name}</Td>
                  <Td>{c.system}</Td>
                  <Td>{confidencePill(c.confidence)}</Td>
                  <Td right>{num(c.transactions)}</Td>
                  <Td className="whitespace-nowrap">
                    {dateShort(c.date_min)}–{dateShort(c.date_max)}
                  </Td>
                  <Td right>{eurCompact(c.net_revenue_total)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 4: Reconciliation status */}
      <Card
        title="Reconciliation status"
        subtitle="Monthly summary (Opco A only) vs aggregated weekly GL credits · variance within ±5% shown as reconciled"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Year</Th>
                <Th right>Weekly credit total</Th>
                <Th right>Monthly summary netto</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {inventory.reconciliation.map((r, i) => (
                <tr key={`${r.company_id}-${r.year}-${i}`}>
                  <Td className="font-medium text-ink">
                    {companyName(r.company_id)}
                  </Td>
                  <Td>{r.year}</Td>
                  <Td right>{eur(r.weekly_credit_total)}</Td>
                  <Td right>
                    {r.monthly_summary_netto != null ? eur(r.monthly_summary_netto) : '—'}
                  </Td>
                  <Td>{reconcileVariance(r.weekly_credit_total, r.monthly_summary_netto)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-2xs text-ink-faint">
          Monthly summary file (Altis dataset 1) covers Opco A only. All other companies have
          no independent monthly benchmark.
        </p>
      </Card>

      {/* Section 5: Source files */}
      <Card
        title="Source files"
        subtitle={`${files.length} files ingested across ${inventory.files_loaded} load events`}
      >
        <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="sticky top-0 bg-panel">
              <tr>
                <Th>Filename</Th>
                <Th>Group</Th>
                <Th>Sheet</Th>
                <Th>System</Th>
                <Th right>Rows</Th>
                <Th>Detected company</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={`${f.filename}-${f.sheet_name}-${i}`}>
                  <Td mono>{f.filename}</Td>
                  <Td>{f.source_group}</Td>
                  <Td mono>{f.sheet_name}</Td>
                  <Td>{f.detected_system}</Td>
                  <Td right>{num(f.row_count)}</Td>
                  <Td>{f.detected_company}</Td>
                  <Td className="text-ink-faint">{f.notes || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 6: Chart-of-accounts mapping */}
      <Card
        title="Chart-of-accounts mapping"
        subtitle="Source codes normalised to canonical revenue categories; sorted by company"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Code</Th>
                <Th>Source name</Th>
                <Th>Normalised category</Th>
                <Th>Confidence</Th>
                <Th>Method</Th>
                <Th right>Txns</Th>
              </tr>
            </thead>
            <tbody>
              {[...accounts]
                .sort((a, b) => a.company.localeCompare(b.company) || a.code.localeCompare(b.code))
                .map((a, i, arr) => {
                  const isGroupStart = i === 0 || arr[i - 1].company !== a.company;
                  return (
                    <tr key={`${a.company}-${a.code}-${i}`}>
                      <Td className={isGroupStart ? 'font-medium text-ink' : 'text-ink-faint'}>
                        {isGroupStart ? a.company : ''}
                      </Td>
                      <Td mono>{a.code}</Td>
                      <Td>{a.name}</Td>
                      <Td mono>{a.category}</Td>
                      <Td>{confidencePill(a.confidence)}</Td>
                      <Td>{a.method}</Td>
                      <Td right>{num(a.txns)}</Td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 7: Assumptions register */}
      <Card
        title="Assumptions register"
        subtitle={
          <span className="flex items-center gap-1.5">
            {inventory.assumptions_created} modelling assumptions
            <AssumptionTag />
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <Th>Category</Th>
                <Th>Key</Th>
                <Th>Value</Th>
                <Th>Source</Th>
                <Th>Rationale</Th>
              </tr>
            </thead>
            <tbody>
              {[...assumptions]
                .sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key))
                .map((a, i, arr) => {
                  const isGroupStart = i === 0 || arr[i - 1].category !== a.category;
                  return (
                    <tr key={a.id}>
                      <Td className={isGroupStart ? 'font-medium text-ink' : 'text-ink-faint'}>
                        {isGroupStart ? a.category : ''}
                      </Td>
                      <Td mono>{a.key}</Td>
                      <Td right mono>{assumptionValue(a)}</Td>
                      <Td>{a.source}</Td>
                      <Td className="text-ink-faint">{a.rationale}</Td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 8: Covenant terms */}
      <Card
        title="Covenant terms"
        subtitle={
          <span className="flex items-center gap-1.5">
            {covenants.length} configurable covenant floors — no formal covenant terms supplied
            <AssumptionTag />
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <Th>Scope</Th>
                <Th>Name</Th>
                <Th>Metric</Th>
                <Th right>Threshold</Th>
                <Th>Direction</Th>
                <Th>Basis</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {covenants.map((c) => (
                <tr key={c.id}>
                  <Td className="font-medium text-ink">
                    {c.companyId == null ? 'Portfolio' : companyName(c.companyId)}
                  </Td>
                  <Td>{c.name}</Td>
                  <Td mono>{c.metric}</Td>
                  <Td right>{eur(c.threshold)}</Td>
                  <Td>{c.direction}</Td>
                  <Td className="text-ink-faint">{c.basis}</Td>
                  <Td>
                    {c.isAssumption ? <AssumptionTag /> : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 9: Missing fields & known gaps */}
      <Card
        title="Missing fields & known gaps"
        subtitle={`${inventory.missing_fields.length} gaps identified — all bridged by configurable assumptions`}
      >
        <ul className="space-y-1.5">
          {inventory.missing_fields.map((field, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
              <span className="mt-0.5 shrink-0 text-ink-faint">·</span>
              {field}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
