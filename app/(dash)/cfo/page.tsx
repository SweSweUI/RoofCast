'use client';
import { useState } from 'react';
import { useDashboardState, useApi } from '@/lib/client/hooks';
import { pickThreshold, useForecast } from '@/lib/client/forecast';
import { SCENARIO_LABELS, type Scenario } from '@/lib/types';
import { SCENARIO_NOTE } from '@/lib/forecast/config';
import { eur, eurCompact, signedEur, dateShort } from '@/lib/format';
import { Card, Kpi, LoadingBlock, Pill, SectionTitle } from '@/components/ui';
import { WeekTable } from '@/components/WeekTable';
import { TracePanel } from '@/components/TracePanel';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { DriverSplitChart } from '@/components/charts/DriverSplitChart';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { CovenantChart } from '@/components/charts/CovenantChart';
import { CompanyCompareChart } from '@/components/charts/CompanyCompareChart';

export default function CfoPage() {
  const { scenario, company } = useDashboardState();
  const { result, companies, loading, error } = useForecast(company, scenario);
  const scenarios = useApi<any>(`/api/scenarios?company=${encodeURIComponent(company)}`);
  const [week, setWeek] = useState<string | null>(null);

  if (error) {
    return (
      <Card title="Data unavailable">
        <p className="text-sm text-ink-muted">{error}</p>
        <p className="mt-2 text-2xs text-ink-faint">Run the pipeline: <code>npm run pipeline</code></p>
      </Card>
    );
  }
  if (!result) return <LoadingBlock label="Computing 13-week forecast…" />;

  const k = result.kpis;
  const { threshold, label } = pickThreshold(result);
  const breach = k.covenantBreach;
  const sc = scenarios.data?.scenarios;
  const scenarioSeries = sc
    ? { base: sc.base?.weeks, wet_quarter: sc.wet_quarter?.weeks, dry_quarter: sc.dry_quarter?.weeks }
    : {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle sub={`${result.companyName} · ${SCENARIO_LABELS[scenario]} scenario · 13 weeks from ${dateShort(result.weeks[0].weekStart)}`}>
          CFO — Operating Cash Forecast
        </SectionTitle>
        <Pill tone="accent" title={SCENARIO_NOTE[scenario]}>
          {k.liveWeatherWeeks} live-weather weeks · then seasonal
        </Pill>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Net cash (13wk)" value={eurCompact(k.netCashFlow)} tone={k.netCashFlow < 0 ? 'bad' : 'good'} sub={signedEur(k.netCashFlow)} />
        <Kpi label="Cash-in (13wk)" value={eurCompact(k.totalCashIn)} sub={eur(k.totalCashIn)} />
        <Kpi label="Cash-out (13wk)" value={eurCompact(k.totalCashOut)} sub={eur(k.totalCashOut)} />
        <Kpi label="Min closing cash" value={eurCompact(k.minClosingCash)} sub={`week of ${dateShort(k.minClosingWeek)}`} tone={breach ? 'bad' : 'default'} />
        <Kpi label="Covenant" value={breach ? 'Breach' : threshold == null ? 'n/a' : 'Headroom'} tone={breach ? 'bad' : 'good'} sub={threshold == null ? 'no floor set' : `floor ${eurCompact(threshold)}`} hint={label} />
        <Kpi label="Weeks at risk" value={`${k.weeksAtRisk}/13`} tone={k.weeksAtRisk > 4 ? 'warn' : 'default'} sub="liquidity / weather" />
      </div>

      <Card title="13-week cash-in / cash-out & closing cash" subtitle="Bars = weekly flows · line = closing cash · shaded = live-forecast weeks">
        <CashflowChart weeks={result.weeks} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Cash-out drivers by week" subtitle="Materials · subcontractor · labour · overhead (configurable assumptions)">
          <DriverSplitChart weeks={result.weeks} />
        </Card>
        <Card title="Scenario comparison — closing cash" subtitle="Base vs wet-quarter vs dry-quarter (timing of cash, not total work)">
          {sc ? <ScenarioCompareChart series={scenarioSeries} /> : <LoadingBlock label="Computing scenarios…" />}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Covenant headroom — ${label}`} subtitle={threshold == null ? 'No covenant floor configured' : `Closing cash vs floor ${eur(threshold)} (assumption)`}>
          <CovenantChart weeks={result.weeks} threshold={threshold} thresholdLabel={label} />
        </Card>
        {companies ? (
          <Card title="Company comparison — net cash (13wk)" subtitle="Click a bar's company in the selector to drill in">
            <CompanyCompareChart
              rows={companies.map((c) => ({
                name: c.companyName,
                value: c.kpis.netCashFlow,
                risk: c.kpis.covenantBreach ? 'high' : c.kpis.weeksAtRisk > 4 ? 'medium' : 'low',
              }))}
              label="Net cash"
            />
          </Card>
        ) : (
          <Card title="Weather delay impact" subtitle="Net € shifted by weather timing, per week">
            <WeatherImpactList weeks={result.weeks} />
          </Card>
        )}
      </div>

      <Card title="Weekly detail & traceability" subtitle="Click any week to trace the number back to drivers, assumptions and source transactions">
        <WeekTable weeks={result.weeks} onPick={setWeek} />
      </Card>

      <p className="text-2xs text-ink-faint">
        Cash-in = facturation collected on a debtor-payment profile. Cash-out drivers, opening cash and covenant
        floors are configurable assumptions (revenue-only source data). See{' '}
        <a className="text-accent underline" href={`/methodology?scenario=${scenario}&company=${company}`}>Methodology</a> and{' '}
        <a className="text-accent underline" href="/data-quality">Data Quality</a>.
      </p>

      <TracePanel company={company} scenario={scenario} week={week} onClose={() => setWeek(null)} />
    </div>
  );
}

function WeatherImpactList({ weeks }: { weeks: any[] }) {
  const rows = weeks.filter((w) => Math.abs(w.weatherAdjustment) >= 1000);
  if (!rows.length) return <p className="text-sm text-ink-muted">No material weather-timing shifts this horizon.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((w) => (
        <li key={w.weekStart} className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">{dateShort(w.weekStart)} · {w.weatherRisk} risk</span>
          <span className={w.weatherAdjustment < 0 ? 'text-risk-high tnum' : 'text-risk-low tnum'}>
            {signedEur(w.weatherAdjustment)}
          </span>
        </li>
      ))}
    </ul>
  );
}
