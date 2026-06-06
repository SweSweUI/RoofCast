'use client';
import { useApi } from '@/lib/client/hooks';
import type { ForecastWeek, Scenario, TraceLink, TransactionRow } from '@/lib/types';
import { eur, signedEur, weekRange, dateShort } from '@/lib/format';
import { RiskBadge, Td, Th } from './ui';

interface TraceResponse {
  company: { code: string; name: string };
  scenario: Scenario;
  week: ForecastWeek;
  trace: TraceLink[];
  analogWeeks: string[];
  transactions: TransactionRow[];
}

const ADDITIVE = new Set([
  'baseline_cash_in',
  'weather_delay',
  'materials',
  'subcontractor',
  'labour',
  'overhead',
]);
const DRIVER_LABEL: Record<string, string> = {
  baseline_cash_in: 'Baseline cash-in',
  weather_delay: 'Weather-delay timing',
  payment_lag: 'Payment-lag (cash vs billed)',
  materials: 'Materials out',
  subcontractor: 'Subcontractor out',
  labour: 'Labour out',
  overhead: 'Overhead out',
};

export function TracePanel({
  company,
  scenario,
  week,
  onClose,
  extra = '',
}: {
  company: string;
  scenario: Scenario;
  week: string | null;
  onClose: () => void;
  extra?: string;
}) {
  const url = week
    ? `/api/trace?company=${encodeURIComponent(company)}&scenario=${scenario}&week=${week}${extra}`
    : null;
  const { data, loading } = useApi<TraceResponse>(url);
  if (!week) return null;

  const w = data?.week;
  const allLinks = data?.trace ?? [];
  const additiveDrivers = allLinks.filter((t) => ADDITIVE.has(t.driver));
  // portfolio trace has per-company links (not in ADDITIVE) — fall back to all.
  const isPortfolio = additiveDrivers.length === 0 && allLinks.length > 0;
  const additive = isPortfolio ? allLinks : additiveDrivers;
  const subtotal = additive.reduce((s, t) => s + t.contributionAmount, 0);
  const paymentLag = isPortfolio ? undefined : allLinks.find((t) => t.driver === 'payment_lag');

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-panel-line bg-panel shadow-xl">
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-panel-line bg-panel px-5 py-4">
          <div>
            <div className="text-2xs uppercase tracking-wide text-ink-faint">
              Traceability · {data?.company.name ?? company}
            </div>
            <h2 className="text-base font-semibold text-ink">Week of {weekRange(week)}</h2>
            {w && (
              <div className="mt-1 flex items-center gap-2">
                <RiskBadge level={w.weatherRisk} label={`${w.weatherRisk} weather`} />
                <RiskBadge level={w.riskLevel} label={`${w.riskLevel} liquidity`} />
                {w.isLiveWeather && (
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-2xs font-medium text-accent">
                    live forecast
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-panel-sunken"
          >
            ✕
          </button>
        </header>

        {loading && !data ? (
          <div className="p-5 text-sm text-ink-faint">Loading trace…</div>
        ) : !w ? (
          <div className="p-5 text-sm text-ink-faint">No data.</div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Mini label="Cash-in" value={eur(w.forecastCashIn)} />
              <Mini label="Cash-out" value={eur(w.forecastCashOut)} />
              <Mini label="Net" value={signedEur(w.netCashFlow)} />
              <Mini label="Closing" value={eur(w.closingCash)} />
            </div>

            <p className="rounded-md bg-panel-sunken p-3 text-sm leading-relaxed text-ink-soft">
              {w.explanation}
            </p>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink">Driver contributions</h3>
              <p className="mb-2 text-2xs text-ink-faint">
                Components sum to net cash flow. Payment-lag is shown separately as a timing note.
              </p>
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Driver</Th>
                    <Th right>€ to net</Th>
                    <Th>Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {additive.map((t, i) => (
                    <tr key={i}>
                      <Td>{DRIVER_LABEL[t.driver] ?? t.driver}</Td>
                      <Td right>{signedEur(t.contributionAmount)}</Td>
                      <Td className="text-2xs text-ink-muted">{t.adjustmentReason}</Td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <Td>Net cash flow</Td>
                    <Td right>{signedEur(Math.round(subtotal))}</Td>
                    <Td className="text-2xs text-ink-faint">= cash-in − cash-out</Td>
                  </tr>
                  {paymentLag && (
                    <tr>
                      <Td className="text-ink-muted">{DRIVER_LABEL.payment_lag}</Td>
                      <Td right className="text-ink-muted">{signedEur(paymentLag.contributionAmount)}</Td>
                      <Td className="text-2xs text-ink-faint">{paymentLag.adjustmentReason}</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(data?.transactions?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink">Source transactions (baseline analogs)</h3>
              <p className="mb-2 text-2xs text-ink-faint">
                Real ledger lines from the historical weeks that inform this week's baseline
                (same ISO week in prior years + recent weeks). This ties the forecast number back
                to source data.
              </p>
              <div className="max-h-72 overflow-y-auto rounded-md border border-panel-line">
                <table className="w-full">
                  <thead className="sticky top-0 bg-panel-sunken">
                    <tr>
                      <Th>Date</Th>
                      <Th>Doc</Th>
                      <Th>Journal</Th>
                      <Th right>Credit</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.transactions ?? []).map((t) => (
                      <tr key={t.id}>
                        <Td className="text-2xs">{dateShort(t.date)}</Td>
                        <Td mono>{t.documentNumber || '—'}</Td>
                        <Td className="text-2xs text-ink-muted">{t.journal}</Td>
                        <Td right>{eur(t.credit)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-panel-line bg-panel-sunken px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="text-sm font-semibold tnum text-ink">{value}</div>
    </div>
  );
}
