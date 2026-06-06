'use client';
import { useState } from 'react';
import { useDashboardState } from '@/lib/client/hooks';
import { pickThreshold, useForecast } from '@/lib/client/forecast';
import { SCENARIO_LABELS } from '@/lib/types';
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
import { CompanyCompareChart } from '@/components/charts/CompanyCompareChart';
import { RiskOverview } from '@/components/RiskOverview';

export default function BoardPage() {
  const { scenario } = useDashboardState();
  const { result, companies, loading, error } = useForecast('portfolio', scenario);
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

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle
          sub={`${companies?.length ?? '—'} operating companies · ${SCENARIO_LABELS[scenario]} · 13 weeks from ${dateShort(result.weeks[0].weekStart)}`}
        >
          PE Board — Portfolio Cash Outlook
        </SectionTitle>
        <Pill tone="accent" title="Operating forecast from live Open-Meteo near term plus seasonal climatology beyond the reliable live-weather window.">
          {k.liveWeatherWeeks} live-weather weeks · then seasonal
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

      {/* risk-first: portfolio weather-to-cash risk signals */}
      <RiskOverview company="portfolio" scenario={scenario} />

      {/* 3. Portfolio cashflow chart */}
      <Card
        title="Portfolio 13-week cash"
        subtitle="Bars = weekly flows across all companies · line = closing cash · shaded = live-forecast weeks"
      >
        <CashflowChart weeks={result.weeks} />
      </Card>

      {/* 4. Two columns: covenant + weather timing */}
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
          title="Weather forecast timing impact"
          subtitle="Operating forecast impact from live weather and seasonal weather outlook"
        >
          <WeatherImpactList weeks={result.weeks} />
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

      {/* 6. Portfolio weekly detail + TracePanel */}
      <Card
        title="Portfolio weekly detail"
        subtitle="Click any week to trace back to drivers, assumptions, and source transactions"
      >
        <WeekTable weeks={result.weeks} onPick={setWeek} />
      </Card>

      {/* 7. Footnote */}
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

function WeatherImpactList({ weeks }: { weeks: any[] }) {
  const rows = weeks.filter((w) => Math.abs(w.weatherAdjustment) >= 1000);
  const net = weeks.reduce((sum, w) => sum + w.weatherAdjustment, 0);
  if (!rows.length) {
    return <p className="text-sm text-ink-muted">No material weather-timing shifts in the current live forecast horizon.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="rounded-md bg-panel-sunken px-3 py-2 text-sm text-ink-soft">
        Net in-horizon weather timing impact: <span className={net < 0 ? 'font-semibold text-risk-high' : 'font-semibold text-risk-low'}>{signedEur(net)}</span>
      </div>
      <ul className="space-y-1.5">
        {rows.slice(0, 6).map((w) => (
          <li key={w.weekStart} className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">{dateShort(w.weekStart)} · {w.weatherRisk} risk</span>
            <span className={w.weatherAdjustment < 0 ? 'text-risk-high tnum' : 'text-risk-low tnum'}>
              {signedEur(w.weatherAdjustment)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
