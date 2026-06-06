'use client';

import { useDashboardState, useApi } from '@/lib/client/hooks';
import { eur, pct } from '@/lib/format';
import {
  AssumptionTag,
  Card,
  Empty,
  LoadingBlock,
  Pill,
  SectionTitle,
  Td,
  Th,
} from '@/components/ui';
import { LagChart } from '@/components/charts/LagChart';
import { WetDryChart } from '@/components/charts/WetDryChart';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface LagRow {
  lag: number;
  r_rain2mm_net: number;
  r_rain2mm_credit: number;
  r_bad_net?: number;
  r_bad_credit?: number;
}

interface WetDryRow {
  lag: number;
  wet_mean: number;
  dry_mean: number;
  pct_diff: number;
  p_value: number;
  n_wet: number;
  n_dry: number;
}

interface YearlyRow {
  year: string;
  pct_diff: number;
  n_wet: number;
  n_dry: number;
}

interface StrongestLag {
  lag: number;
  r: number;
  target: string;
  predictor: string;
}

interface CompanyStats {
  label: string;
  n_weeks: number;
  lag_table?: LagRow[];
  strongest_lag?: StrongestLag;
  wet_dry?: WetDryRow[];
  yearly_lag5?: YearlyRow[];
}

interface StatsResponse {
  pending?: boolean;
  message?: string;
  generated_at?: string;
  method_notes?: string;
  companies?: Record<string, CompanyStats>;
}

/* ------------------------------------------------------------------ */
/* Company code resolution                                             */
/* ------------------------------------------------------------------ */

const COMPANY_CODES = ['ummels', 'opco-a', 'opco-gilde'];

function resolveCode(company: string, companies: Record<string, CompanyStats>): string {
  if (company !== 'portfolio' && COMPANY_CODES.includes(company) && companies[company]) {
    return company;
  }
  return 'ummels';
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function AmberCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {children}
    </div>
  );
}

function ModelLayerList() {
  const layers: { num: number; title: string; body: React.ReactNode }[] = [
    {
      num: 1,
      title: 'Historical baseline',
      body: 'An 8-week deseasonalised run-rate is multiplied by an ISO-week seasonal index derived from reconciled weekly facturation. This gives a company-specific expected production level for each future week.',
    },
    {
      num: 2,
      title: 'Driver decomposition',
      body: (
        <>
          Materials, subcontractor, labour and overhead are each expressed as a configurable
          percentage of production to estimate cash-out, because the source data is revenue-only
          with no cost detail.{' '}
          <AssumptionTag>assumption</AssumptionTag>
        </>
      ),
    },
    {
      num: 3,
      title: 'Weather-delay timing shift',
      body: 'Weeks with 3 or more rain workdays are classified as high-risk and approximately 25% of billing is deferred by +4 to +7 weeks; weeks with 2 rain workdays defer ~12%. This is a timing shift — the work is assumed to happen, just later.',
    },
    {
      num: 4,
      title: 'Payment-lag cash-in',
      body: (
        <>
          Facturation is collected via a debtor-payment profile that peaks at approximately
          t+4 weeks — i.e., an invoice issued this week is mostly collected 4 weeks later.{' '}
          <AssumptionTag>assumption</AssumptionTag>
        </>
      ),
    },
    {
      num: 5,
      title: 'Forecast basis',
      body: 'The operating view uses live Open-Meteo weather for the near term, then ISO-week seasonal climatology beyond the reliable forecast window. Internal stress-test variants may be retained for audit/testing, but they are not a CFO selection step.',
    },
    {
      num: 6,
      title: 'Covenant headroom',
      body: (
        <>
          Closing cash in each week is compared against configurable minimum-cash floors. A breach
          flag fires when closing cash is projected to fall below any active floor.{' '}
          <AssumptionTag>assumption</AssumptionTag>
        </>
      ),
    },
  ];

  return (
    <ol className="space-y-3">
      {layers.map(({ num, title, body }) => (
        <li key={num} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-sunken text-2xs font-semibold text-ink-faint ring-1 ring-panel-line">
            {num}
          </span>
          <div className="text-sm text-ink-soft">
            <span className="font-medium text-ink">{title} — </span>
            {body}
          </div>
        </li>
      ))}
    </ol>
  );
}

function WetDryTable({ rows }: { rows: WetDryRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr>
            <Th>Lag</Th>
            <Th right>Wet mean</Th>
            <Th right>Dry mean</Th>
            <Th right>% diff</Th>
            <Th right>p-value</Th>
            <Th right>n wet</Th>
            <Th right>n dry</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isLag5 = r.lag === 5;
            return (
              <tr key={r.lag} className={isLag5 ? 'bg-amber-50' : undefined}>
                <Td>
                  <span className={isLag5 ? 'font-semibold text-amber-800' : undefined}>
                    lag {r.lag}
                    {isLag5 ? ' ★' : ''}
                  </span>
                </Td>
                <Td right>{eur(r.wet_mean)}</Td>
                <Td right>{eur(r.dry_mean)}</Td>
                <Td right>
                  <span className={r.pct_diff < 0 ? 'text-risk-high' : 'text-risk-low'}>
                    {pct(r.pct_diff, 1)}
                  </span>
                </Td>
                <Td right>{r.p_value.toFixed(3)}</Td>
                <Td right>{r.n_wet}</Td>
                <Td right>{r.n_dry}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function YearlyTable({ rows }: { rows: YearlyRow[] }) {
  // Determine if the sign is stable (all negative or all positive, ignoring ~0)
  const nonTrivial = rows.filter((r) => Math.abs(r.pct_diff) > 0.02);
  const allNeg = nonTrivial.length > 0 && nonTrivial.every((r) => r.pct_diff < 0);
  const allPos = nonTrivial.length > 0 && nonTrivial.every((r) => r.pct_diff > 0);
  const signNote = allNeg
    ? 'The sign is consistently negative across all years shown — wet weeks tend to coincide with lower relative revenue at lag 5, though the magnitude varies.'
    : allPos
      ? 'The sign is consistently positive across all years — no clear wet-week dip at this lag for this company.'
      : 'The sign is mixed across years — the lag-5 dip is not stable in direction, so confidence in the pattern is lower.';

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <Th>Year</Th>
              <Th right>% diff (wet vs dry)</Th>
              <Th right>n wet</Th>
              <Th right>n dry</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <Td>{r.year}</Td>
                <Td right>
                  <span className={r.pct_diff < 0 ? 'text-risk-high' : 'text-risk-low'}>
                    {pct(r.pct_diff, 1)}
                  </span>
                </Td>
                <Td right>{r.n_wet}</Td>
                <Td right>{r.n_dry}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-ink-muted">{signNote}</p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MethodologyPage() {
  const { company } = useDashboardState();
  const { data, loading, error } = useApi<StatsResponse>('/api/stats');

  /* Loading */
  if (loading && !data) {
    return <LoadingBlock label="Loading validation stats…" />;
  }

  /* Fetch error */
  if (error) {
    return (
      <Card title="Stats unavailable">
        <p className="text-sm text-ink-muted">{error}</p>
        <p className="mt-2 text-2xs text-ink-faint">
          Re-run the analysis pipeline: <code>npm run stats</code>
        </p>
      </Card>
    );
  }

  /* Pending (pipeline not yet run) */
  if (!data || data.pending) {
    return (
      <Card title="Stats not yet computed">
        <p className="text-sm text-ink-muted">{data?.message ?? 'No stats available.'}</p>
        <p className="mt-2 text-2xs text-ink-faint">
          Run: <code>npm run stats</code> then reload this page.
        </p>
      </Card>
    );
  }

  const companies = data.companies ?? {};
  const code = resolveCode(company, companies);
  const cs: CompanyStats | undefined = companies[code];

  const lagTable = cs?.lag_table ?? [];
  const wetDry = cs?.wet_dry ?? [];
  const yearly = cs?.yearly_lag5 ?? [];
  const sl = cs?.strongest_lag;

  return (
    <div className="space-y-5">
      {/* ── 1. Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle
          sub={
            cs
              ? `${cs.label} · ${cs.n_weeks} weeks analysed`
              : `Company: ${code} · select via the top-bar selector`
          }
        >
          Methodology — Weather-Delay Model &amp; Validation
        </SectionTitle>
        <Pill tone="muted">validation stats</Pill>
      </div>

      <AmberCallout>
        <p className="font-semibold">Signal caveat — read before interpreting numbers below</p>
        {data.method_notes && (
          <p className="mt-1 text-amber-800">{data.method_notes}</p>
        )}
        <p className="mt-2 font-medium">
          This is a weather-delay <em>risk signal</em>, not causal proof. The correlation is weak;
          weather explains only part of revenue variance. Key wet-vs-dry comparison p ≈ 0.065–0.19
          depending on window.
        </p>
      </AmberCallout>

      {/* ── 2. How the forecast is built ──────────────────────────── */}
      <Card title="How the forecast is built" subtitle="6 model layers — no code, plain language">
        <ModelLayerList />
      </Card>

      {/* ── 3. Lag analysis ───────────────────────────────────────── */}
      <Card
        title="Lag analysis — rain workdays (week t) vs revenue (week t+lag)"
        subtitle="Pearson r across all historical weeks. Negative = lower revenue after rainy weeks at that lag."
      >
        {lagTable.length > 0 ? (
          <>
            <LagChart data={lagTable} />
            <p className="mt-2 text-2xs text-ink-muted">
              Negative values indicate lower revenue at that lag distance after rainy weeks. Note
              the dip around lag 5 — this is the main timing signal used in the model.
            </p>
            {sl && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-2xs text-ink-faint">Strongest single point:</span>
                <Pill tone="neutral">
                  r = {sl.r.toFixed(3)} at lag {sl.lag} ({sl.predictor} → {sl.target})
                </Pill>
              </div>
            )}
          </>
        ) : (
          <Empty>No lag table data available for this company.</Empty>
        )}
      </Card>

      {/* ── 4. Wet vs dry ─────────────────────────────────────────── */}
      <Card
        title="Wet vs dry weeks — mean revenue deviation from baseline, by lag"
        subtitle="Compares weeks preceded by ≥3 rainy days (wet) vs 0 rainy days (dry). Uses revenue_delta_pct to reduce trend/seasonality noise."
      >
        {wetDry.length > 0 ? (
          <>
            <WetDryChart data={wetDry} />
            <WetDryTable rows={wetDry} />
            <p className="mt-3 text-sm text-ink-muted">
              At lag 5, wet weeks show a ~25–35% lower deviation from baseline compared with dry
              weeks in the primary company — but p is not below 0.05 (permutation test,
              5,000 iterations). The signal is <strong>suggestive only</strong>. It is used in the
              model to shift the <em>timing</em> of projected cash-in, not to reduce total revenue.
            </p>
          </>
        ) : (
          <Empty>No wet/dry comparison data available for this company.</Empty>
        )}
      </Card>

      {/* ── 5. Year-by-year robustness ────────────────────────────── */}
      <Card
        title="Year-by-year robustness — lag 5 wet vs dry (pct_diff)"
        subtitle="Does the dip at lag 5 appear consistently across calendar years?"
      >
        {yearly.length > 0 ? (
          <YearlyTable rows={yearly} />
        ) : (
          <Empty>No yearly breakdown available for this company.</Empty>
        )}
      </Card>

      {/* ── 6. Interpretation ─────────────────────────────────────── */}
      <Card title="Interpretation — how to read this model">
        <div className="space-y-3 text-sm text-ink-soft">
          <p>
            The causal chain we model is:{' '}
            <span className="font-medium text-ink">
              bad weather → execution delay → milestone delay → billing delay → cash-in delay →
              possible partial catch-up
            </span>
            . At no point does the model assume revenue is permanently lost — the deferred billing
            is assumed to arrive over a +4 to +7 week window.
          </p>
          <p>
            Weather is therefore modelled as a <em>timing</em> effect on cash-in, not a demand or
            margin effect. Sectors such as civil construction and outdoor installation work are
            particularly susceptible to rain-day disruption, which is why the signal exists at all.
            But other factors — project pipeline composition, invoicing cycles, public-holiday
            patterns, subcontractor availability — explain the majority of week-to-week revenue
            variance.
          </p>
          <p>
            Use this model as a <strong>planning signal</strong>: when a wet period is forecast or
            observed, expect cash-in to be shifted ~4–5 weeks later than the seasonal baseline,
            and size liquidity headroom accordingly. Do not treat the percentage estimates as
            precise predictions — the confidence intervals are wide and the signal is
            company-specific and year-specific.
          </p>
          <p className="text-2xs text-ink-faint">
            For data lineage and source-data quality, see the{' '}
            <a className="text-accent underline" href="/data-quality">
              Data Quality
            </a>{' '}
            page. For the live forecast and covenant checks, see the{' '}
            <a className="text-accent underline" href="/cfo">
              CFO view
            </a>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}
