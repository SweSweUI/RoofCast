'use client';
import { useState } from 'react';
import { useDashboardState, useApi } from '@/lib/client/hooks';
import { pickThreshold, useForecast } from '@/lib/client/forecast';
import { SCENARIO_LABELS, type Scenario } from '@/lib/types';
import { SCENARIO_NOTE } from '@/lib/forecast/config';
import { eur, eurCompact, signedEur, dateShort } from '@/lib/format';
import {
  Card,
  Kpi,
  LoadingBlock,
  Pill,
  SectionTitle,
  RiskBadge,
  AssumptionTag,
  Th,
  Td,
} from '@/components/ui';
import { WeekTable } from '@/components/WeekTable';
import { TracePanel } from '@/components/TracePanel';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { CovenantChart } from '@/components/charts/CovenantChart';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { CompanyCompareChart } from '@/components/charts/CompanyCompareChart';

export default function BoardPage() {
  const { scenario } = useDashboardState();
  const { result, companies, loading, error } = useForecast('portfolio', scenario);
  const scenarios = useApi<any>(`/api/scenarios?company=portfolio`);
  const [week, setWeek] = useState<string | null>(null);

  if (error) {
    return (
      <Card title="Data unavailable">
        <p className="text-sm text-ink-muted">{error}</p>
        <p className="mt-2 text-2xs text-ink-faint">
          Run the pipeline: <code>npm run pipeline</code>
        </p>
      </Card>
    );
  }
  if (!result) return <LoadingBlock label="Computing portfolio forecast…" />;

  const k = result.kpis;
  const { threshold, label } = pickThreshold(result);
  const breach = k.covenantBreach;
  const sc = scenarios.data?.scenarios;
  const scenarioSeries = sc
    ? {
        base: sc.base?.weeks,
        wet_quarter: sc.wet_quarter?.weeks,
        dry_quarter: sc.dry_quarter?.weeks,
      }
    : {};

  // Companies at risk: covenantBreach OR weeksAtRisk > 4
  const atRisk = (companies ?? []).filter(
    (c) => c.kpis.covenantBreach || c.kpis.weeksAtRisk > 4,
  );

  // Sort companies worst-first for the table
  const sortedCompanies = [...(companies ?? [])].sort((a, b) => {
    const riskScore = (c: typeof a) =>
      (c.kpis.covenantBreach ? 2 : 0) + (c.kpis.weeksAtRisk > 4 ? 1 : 0);
    const diff = riskScore(b) - riskScore(a);
    if (diff !== 0) return diff;
    return a.kpis.minClosingCash - b.kpis.minClosingCash;
  });

  // Scenario summary data
  const baseSc = sc?.base;
  const wetSc = sc?.wet_quarter;
  const drySc = sc?.dry_quarter;

  const deltaWet =
    baseSc && wetSc
      ? baseSc.kpis.totalCashIn - wetSc.kpis.totalCashIn
      : null;

  const scenarioRows: Array<{
    key: Scenario;
    label: string;
    netCash: number | null;
    minLiquidity: number | null;
    weeksAtRisk: number | null;
  }> = [
    {
      key: 'base',
      label: SCENARIO_LABELS.base,
      netCash: baseSc?.kpis?.netCashFlow ?? null,
      minLiquidity: baseSc?.kpis?.minClosingCash ?? null,
      weeksAtRisk: baseSc?.kpis?.weeksAtRisk ?? null,
    },
    {
      key: 'wet_quarter',
      label: SCENARIO_LABELS.wet_quarter,
      netCash: wetSc?.kpis?.netCashFlow ?? null,
      minLiquidity: wetSc?.kpis?.minClosingCash ?? null,
      weeksAtRisk: wetSc?.kpis?.weeksAtRisk ?? null,
    },
    {
      key: 'dry_quarter',
      label: SCENARIO_LABELS.dry_quarter,
      netCash: drySc?.kpis?.netCashFlow ?? null,
      minLiquidity: drySc?.kpis?.minClosingCash ?? null,
      weeksAtRisk: drySc?.kpis?.weeksAtRisk ?? null,
    },
  ];

  // Plain-English board takeaway
  const boardTakeaway = (() => {
    if (!baseSc || !wetSc) return 'Scenario data loading…';
    const baseRisk = baseSc.kpis.weeksAtRisk ?? 0;
    const wetRisk = wetSc.kpis.weeksAtRisk ?? 0;
    const xStr = deltaWet != null ? eurCompact(deltaWet) : '—';
    return `A wet quarter pushes ~${xStr} of billing beyond the 13-week window and lifts portfolio weeks-at-risk from ${baseRisk} to ${wetRisk}. A dry quarter has the inverse effect, releasing cash earlier.`;
  })();

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle
          sub={`${companies?.length ?? '—'} operating companies · ${SCENARIO_LABELS[scenario]} scenario · 13 weeks from ${dateShort(result.weeks[0].weekStart)}`}
        >
          PE Board — Portfolio Cash Outlook
        </SectionTitle>
        <Pill tone="accent" title={SCENARIO_NOTE[scenario]}>
          {SCENARIO_NOTE[scenario]}
        </Pill>
      </div>

      {/* 2. KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Portfolio net cash (13wk)"
          value={eurCompact(k.netCashFlow)}
          tone={k.netCashFlow < 0 ? 'bad' : 'good'}
          sub={signedEur(k.netCashFlow)}
        />
        <Kpi
          label="Min portfolio liquidity"
          value={eurCompact(k.minClosingCash)}
          sub={`week of ${dateShort(k.minClosingWeek)}`}
          tone={breach ? 'bad' : 'default'}
          hint={breach ? 'Covenant breach detected' : undefined}
        />
        <Kpi
          label="Companies at risk"
          value={`${atRisk.length}/${companies?.length ?? '—'}`}
          tone={atRisk.length > 0 ? 'warn' : 'good'}
          sub="covenant breach or >4 weeks at risk"
        />
        <Kpi
          label="Portfolio cash-in (13wk)"
          value={eurCompact(k.totalCashIn)}
          sub={eur(k.totalCashIn)}
        />
        <Kpi
          label="Portfolio cash-out (13wk)"
          value={eurCompact(k.totalCashOut)}
          sub={eur(k.totalCashOut)}
        />
        <Kpi
          label="Live-weather weeks"
          value={`${k.liveWeatherWeeks}/13`}
          sub="Open-Meteo · then seasonal"
        />
      </div>

      {/* 3. Portfolio cashflow chart */}
      <Card
        title="Portfolio 13-week cash"
        subtitle="Bars = weekly flows across all companies · line = closing cash · shaded = live-forecast weeks"
      >
        <CashflowChart weeks={result.weeks} />
      </Card>

      {/* 4. Two columns: covenant + scenario compare */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title={`Liquidity vs covenant floor — ${label}`}
          subtitle={
            threshold == null
              ? 'No covenant floor configured'
              : `Portfolio closing cash vs floor ${eur(threshold)} (assumption)`
          }
          right={threshold != null ? <AssumptionTag>assumption</AssumptionTag> : undefined}
        >
          <CovenantChart
            weeks={result.weeks}
            threshold={threshold}
            thresholdLabel={label}
          />
        </Card>
        <Card
          title="Scenario comparison — portfolio liquidity"
          subtitle="Base vs wet-quarter vs dry-quarter: closing cash timing across the 13-week horizon"
        >
          {sc ? (
            <ScenarioCompareChart series={scenarioSeries} />
          ) : (
            <LoadingBlock label="Computing scenarios…" />
          )}
        </Card>
      </div>

      {/* 5. Companies at risk */}
      <Card
        title="Companies at risk"
        subtitle="Sorted worst-first: covenant breach → weeks at risk → min closing cash"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th right>Net cash (13wk)</Th>
                  <Th right>Min closing</Th>
                  <Th right>Min headroom</Th>
                  <Th right>Wks at risk</Th>
                  <Th>Risk</Th>
                </tr>
              </thead>
              <tbody>
                {sortedCompanies.map((c) => {
                  const minHeadroom =
                    c.weeks.length > 0
                      ? Math.min(
                          ...c.weeks
                            .map((w) => w.covenantHeadroom)
                            .filter((h): h is number => h != null),
                        )
                      : null;
                  const riskLevel: 'high' | 'medium' | 'low' = c.kpis.covenantBreach
                    ? 'high'
                    : c.kpis.weeksAtRisk > 4
                    ? 'medium'
                    : 'low';
                  return (
                    <tr key={c.companyName} className="hover:bg-panel-sunken">
                      <Td>
                        <span className="font-medium text-ink">{c.companyName}</span>
                      </Td>
                      <Td right>
                        <span
                          className={
                            c.kpis.netCashFlow < 0 ? 'text-risk-high' : 'text-ink-soft'
                          }
                        >
                          {signedEur(c.kpis.netCashFlow)}
                        </span>
                      </Td>
                      <Td right>{eurCompact(c.kpis.minClosingCash)}</Td>
                      <Td right>
                        {minHeadroom != null && Number.isFinite(minHeadroom) ? (
                          <span
                            className={
                              minHeadroom < 0 ? 'text-risk-high' : 'text-ink-soft'
                            }
                          >
                            {signedEur(minHeadroom)}
                          </span>
                        ) : (
                          <span className="text-ink-faint">n/a</span>
                        )}
                      </Td>
                      <Td right>
                        <span
                          className={
                            c.kpis.weeksAtRisk > 4 ? 'text-risk-medium' : 'text-ink-soft'
                          }
                        >
                          {c.kpis.weeksAtRisk}/13
                        </span>
                      </Td>
                      <Td>
                        <RiskBadge level={riskLevel} />
                      </Td>
                    </tr>
                  );
                })}
                {sortedCompanies.length === 0 && (
                  <tr>
                    <Td className="py-4 text-center text-ink-faint" colSpan={6}>
                      No company data
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Company compare chart */}
          <div>
            <p className="mb-2 text-2xs uppercase tracking-wide text-ink-faint">
              Net cash (13wk) per company
            </p>
            <CompanyCompareChart
              rows={sortedCompanies.map((c) => ({
                name: c.companyName,
                value: c.kpis.netCashFlow,
                risk: c.kpis.covenantBreach
                  ? 'high'
                  : c.kpis.weeksAtRisk > 4
                  ? 'medium'
                  : 'low',
              }))}
              label="Net cash"
            />
          </div>
        </div>
      </Card>

      {/* 6. Scenario summary for the board */}
      <Card
        title="Scenario summary for the board"
        subtitle="Portfolio-level: net cash, min liquidity, weeks at risk across all three planning scenarios"
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px]">
              <thead>
                <tr>
                  <Th>Scenario</Th>
                  <Th right>Net cash (13wk)</Th>
                  <Th right>Min liquidity</Th>
                  <Th right>Weeks at risk</Th>
                </tr>
              </thead>
              <tbody>
                {scenarioRows.map((row) => (
                  <tr
                    key={row.key}
                    className={
                      row.key === scenario ? 'bg-accent-soft/40' : 'hover:bg-panel-sunken'
                    }
                  >
                    <Td>
                      <span className="font-medium text-ink">{row.label}</span>
                      {row.key === scenario && (
                        <span className="ml-1.5 text-2xs text-accent">← active</span>
                      )}
                    </Td>
                    <Td right>
                      {row.netCash != null ? (
                        <span
                          className={
                            row.netCash < 0 ? 'text-risk-high' : 'text-ink-soft'
                          }
                        >
                          {signedEur(row.netCash)}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td right>
                      {row.minLiquidity != null ? eurCompact(row.minLiquidity) : '—'}
                    </Td>
                    <Td right>
                      {row.weeksAtRisk != null ? (
                        <span
                          className={
                            row.weeksAtRisk > 4 ? 'text-risk-medium' : 'text-ink-soft'
                          }
                        >
                          {row.weeksAtRisk}/13
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sc ? (
            <div className="rounded-md bg-panel-sunken p-3 text-sm leading-relaxed text-ink-soft">
              <span className="mr-1.5 font-semibold text-ink">Board takeaway:</span>
              {boardTakeaway}
            </div>
          ) : (
            <LoadingBlock label="Computing scenario comparison…" />
          )}
        </div>
      </Card>

      {/* 7. Portfolio weekly detail + TracePanel */}
      <Card
        title="Portfolio weekly detail"
        subtitle="Click any week to trace back to drivers, assumptions, and source transactions"
      >
        <WeekTable weeks={result.weeks} onPick={setWeek} />
      </Card>

      {/* 8. Footnote */}
      <p className="text-2xs text-ink-faint">
        Covenant floors <AssumptionTag /> and opening cash <AssumptionTag /> are
        configurable assumptions — the revenue-only source data contains no bank
        balances. See{' '}
        <a className="text-accent underline" href="/data-quality">
          Data Quality
        </a>{' '}
        and{' '}
        <a className="text-accent underline" href="/methodology">
          Methodology
        </a>
        .
      </p>

      <TracePanel
        company="portfolio"
        scenario={scenario}
        week={week}
        onClose={() => setWeek(null)}
      />
    </div>
  );
}
