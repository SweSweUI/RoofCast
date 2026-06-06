'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useDashboardState } from '@/lib/client/hooks';
import { pickThreshold, useForecast } from '@/lib/client/forecast';
import { useSettings, WEATHER_RULES } from '@/lib/client/settings';
import { SCENARIO_NOTE } from '@/lib/forecast/config';
import { eur, eurCompact, signedEur, dateShort } from '@/lib/format';
import { Card, Kpi, LoadingBlock, Pill, SectionTitle } from '@/components/ui';
import { WeekTable } from '@/components/WeekTable';
import { TracePanel } from '@/components/TracePanel';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { DriverSplitChart } from '@/components/charts/DriverSplitChart';
import { CovenantChart } from '@/components/charts/CovenantChart';
import { CompanyCompareChart } from '@/components/charts/CompanyCompareChart';
import { RiskOverview } from '@/components/RiskOverview';
import { EmailFindingsButton } from '@/components/EmailFindingsButton';
import { CfoMethodologyPanel } from '@/components/CfoMethodologyPanel';
import { MiniDataAgent } from '@/components/MiniDataAgent';

export default function CfoPage() {
  const { scenario, company } = useDashboardState();
  const { settings, query, overrides } = useSettings();
  const [week, setWeek] = useState<string | null>(null);

  const rulePreset = WEATHER_RULES.find((r) => r.mode === settings.weatherRiskMode) ?? WEATHER_RULES[0];
  const weatherRule = {
    label: rulePreset.label,
    mode: rulePreset.mode,
    medium: settings.weatherMediumThreshold,
    high: settings.weatherHighThreshold,
    explanationEn: rulePreset.en,
    explanationNl: rulePreset.nl,
  };

  const { result, companies, error } = useForecast(company, scenario, query);

  if (error) {
    return (
      <Card title="Data unavailable">
        <p className="text-sm text-ink-muted">{error}</p>
        <p className="mt-2 text-2xs text-ink-faint">Run the pipeline: <code>npm run pipeline</code></p>
      </Card>
    );
  }
  if (!result) return <LoadingBlock label={`Computing ${settings.horizonWeeks}-week forecast...`} />;

  const k = result.kpis;
  const { threshold, label } = pickThreshold(result);
  const breach = k.covenantBreach;
  const activeHorizon = result.params.horizonWeeks;
  const weatherImpact = result.weeks.reduce((sum, w) => sum + w.weatherAdjustment, 0);
  const shareEmail = buildCfoEmail({
    companyName: result.companyName,
    horizonWeeks: activeHorizon,
    startWeek: result.weeks[0].weekStart,
    netCashFlow: k.netCashFlow,
    totalCashIn: k.totalCashIn,
    totalCashOut: k.totalCashOut,
    minClosingCash: k.minClosingCash,
    minClosingWeek: k.minClosingWeek,
    weeksAtRisk: k.weeksAtRisk,
    liveWeatherWeeks: k.liveWeatherWeeks,
    weatherImpact,
    covenant: breach ? 'Breach' : threshold == null ? 'n/a' : 'Headroom',
    weatherRule: weatherRule.label,
    weatherRows: result.weeks
      .filter((w) => Math.abs(w.weatherAdjustment) >= 1000)
      .slice(0, 5)
      .map((w) => `${dateShort(w.weekStart)}: ${w.weatherRisk} weather risk (${w.weatherRiskValue} ${w.weatherRiskBasis}), ${signedEur(w.weatherAdjustment)} cash timing`),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle sub={`${result.companyName} · live weather basis · ${activeHorizon} weeks from ${dateShort(result.weeks[0].weekStart)}`}>
          CFO Cash Forecast
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <EmailFindingsButton subject={shareEmail.subject} body={shareEmail.body} />
          <Pill tone="accent" title={SCENARIO_NOTE[scenario]}>
            {k.liveWeatherWeeks}/{activeHorizon} live-weather weeks
          </Pill>
        </div>
      </div>

      {/* Read-only summary of the assumptions in effect — controls live in Settings */}
      <SettingsSummary
        horizonWeeks={activeHorizon}
        weatherRuleLabel={weatherRule.label}
        floor={threshold}
        dividend={settings.weeklyOtherCashOut}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={`Net cash (${activeHorizon}wk)`} value={eurCompact(k.netCashFlow)} tone={k.netCashFlow < 0 ? 'bad' : 'good'} sub={signedEur(k.netCashFlow)} />
        <Kpi label={`Cash-in (${activeHorizon}wk)`} value={eurCompact(k.totalCashIn)} sub={eur(k.totalCashIn)} />
        <Kpi label={`Cash-out (${activeHorizon}wk)`} value={eurCompact(k.totalCashOut)} sub={eur(k.totalCashOut)} />
        <Kpi label="Min closing cash" value={eurCompact(k.minClosingCash)} sub={`week of ${dateShort(k.minClosingWeek)}`} tone={breach ? 'bad' : 'default'} />
        <Kpi label="Covenant" value={breach ? 'Breach' : threshold == null ? 'n/a' : 'Headroom'} tone={breach ? 'bad' : 'good'} sub={threshold == null ? 'no floor set' : `floor ${eurCompact(threshold)}`} hint={label} />
        <Kpi label="Weeks at risk" value={`${k.weeksAtRisk}/${activeHorizon}`} tone={k.weeksAtRisk > activeHorizon * 0.3 ? 'warn' : 'default'} sub="liquidity / weather" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.7fr)]">
        <CfoMethodologyPanel
          language={settings.language}
          horizonWeeks={activeHorizon}
          weatherRule={weatherRule}
          covenantFloor={threshold}
        />
        <MiniDataAgent
          company={company}
          scenario={scenario}
          overrides={overrides}
          language={settings.language}
        />
      </div>

      {/* risk-first: surface the eight weather-to-cash risk signals before the charts */}
      <RiskOverview company={company} scenario={scenario} extra={query} horizonWeeks={activeHorizon} />

      <Card title={`${activeHorizon}-week cash-in / cash-out & closing cash`} subtitle="Bars = weekly flows · line = closing cash · shaded = live-forecast weeks · drag or use the range buttons to zoom">
        <CashflowChart weeks={result.weeks} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Cash-out drivers by week" subtitle="Materials · subcontractor · labour · overhead (configurable assumptions)">
          <DriverSplitChart weeks={result.weeks} />
        </Card>
        <Card title="Weather forecast timing impact" subtitle={`${weatherRule.label}: live weather-driven cash timing shifts`}>
          <WeatherImpactList weeks={result.weeks} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Covenant headroom — ${label}`} subtitle={threshold == null ? 'No covenant floor configured' : `Closing cash vs floor ${eur(threshold)} (assumption)`}>
          <CovenantChart weeks={result.weeks} threshold={threshold} thresholdLabel={label} />
        </Card>
        {companies ? (
          <Card title={`Company comparison — net cash (${activeHorizon}wk)`} subtitle="Switch company in the top bar to drill in">
            <CompanyCompareChart
              rows={companies.map((c) => ({
                name: c.companyName,
                value: c.kpis.netCashFlow,
                risk: c.kpis.covenantBreach ? 'high' : c.kpis.weeksAtRisk > activeHorizon * 0.3 ? 'medium' : 'low',
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
        Cash-in = facturation collected on a debtor-payment profile. Cash-out drivers, dividends, opening cash and covenant
        floors are configurable assumptions (revenue-only source data) — change them in{' '}
        <Link className="text-accent underline" href="/settings">Settings</Link>. See{' '}
        <a className="text-accent underline" href={`/methodology?company=${company}`}>Methodology</a> and{' '}
        <a className="text-accent underline" href="/data-quality">Data Quality</a>.
      </p>

      <TracePanel company={company} scenario={scenario} week={week} onClose={() => setWeek(null)} extra={query} />
    </div>
  );
}

function SettingsSummary({
  horizonWeeks,
  weatherRuleLabel,
  floor,
  dividend,
}: {
  horizonWeeks: number;
  weatherRuleLabel: string;
  floor: number | null;
  dividend: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-panel-line bg-panel-sunken px-3 py-2 text-2xs text-ink-muted">
      <span className="font-semibold uppercase tracking-wide text-ink-faint">Assumptions</span>
      <Chip>{horizonWeeks}-week horizon</Chip>
      <Chip>{weatherRuleLabel}</Chip>
      <Chip>floor {floor == null ? 'n/a' : eurCompact(floor)}</Chip>
      {dividend > 0 && <Chip>dividend {eurCompact(dividend)}/wk</Chip>}
      <Link href="/settings" className="ml-auto rounded-md border border-panel-line bg-panel px-2 py-1 font-medium text-accent hover:border-accent/40">
        Edit in Settings →
      </Link>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-panel px-1.5 py-0.5 ring-1 ring-inset ring-panel-line tnum">{children}</span>;
}

function buildCfoEmail(input: {
  companyName: string;
  horizonWeeks: number;
  startWeek: string;
  netCashFlow: number;
  totalCashIn: number;
  totalCashOut: number;
  minClosingCash: number;
  minClosingWeek: string;
  weeksAtRisk: number;
  liveWeatherWeeks: number;
  weatherImpact: number;
  covenant: string;
  weatherRule: string;
  weatherRows: string[];
}) {
  const subject = `Altis cash forecast findings - ${input.companyName}`;
  const body = [
    `Altis cash forecast findings - ${input.companyName}`,
    `Forecast start: ${dateShort(input.startWeek)}`,
    '',
    `${input.horizonWeeks}-week net cash: ${signedEur(input.netCashFlow)}`,
    `Cash-in: ${eur(input.totalCashIn)}`,
    `Cash-out: ${eur(input.totalCashOut)}`,
    `Minimum closing cash: ${eur(input.minClosingCash)} in week of ${dateShort(input.minClosingWeek)}`,
    `Covenant status: ${input.covenant}`,
    `Weeks at risk: ${input.weeksAtRisk}/${input.horizonWeeks}`,
    `Weather timing impact: ${signedEur(input.weatherImpact)}`,
    `Weather basis: ${input.liveWeatherWeeks}/${input.horizonWeeks} live Open-Meteo weeks, then seasonal climatology`,
    `Bad-weather rule: ${input.weatherRule}`,
    '',
    'Weather timing highlights:',
    ...(input.weatherRows.length ? input.weatherRows.map((row) => `- ${row}`) : ['- No material weather-timing shifts this horizon.']),
    '',
    'Please review the dashboard for traceability, source data, and weekly detail.',
  ].join('\n');

  return { subject, body };
}

function WeatherImpactList({ weeks }: { weeks: any[] }) {
  const rows = weeks.filter((w) => Math.abs(w.weatherAdjustment) >= 1000);
  if (!rows.length) return <p className="text-sm text-ink-muted">No material weather-timing shifts this horizon.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((w) => (
        <li key={w.weekStart} className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">{dateShort(w.weekStart)} · {w.weatherRisk} risk · {w.weatherRiskValue} {w.weatherRiskBasis}</span>
          <span className={w.weatherAdjustment < 0 ? 'text-risk-high tnum' : 'text-risk-low tnum'}>
            {signedEur(w.weatherAdjustment)}
          </span>
        </li>
      ))}
    </ul>
  );
}
