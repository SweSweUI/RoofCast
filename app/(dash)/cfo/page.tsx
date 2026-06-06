'use client';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { useDashboardState } from '@/lib/client/hooks';
import { pickThreshold, useForecast } from '@/lib/client/forecast';
import type { ForecastParams, WeatherRiskMode } from '@/lib/types';
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

type CfoLanguage = 'en' | 'nl';

interface WeatherRulePreset {
  id: 'base' | 'heavy' | 'site';
  label: string;
  mode: WeatherRiskMode;
  medium: number;
  high: number;
  explanationEn: string;
  explanationNl: string;
}

const HORIZON_OPTIONS = [13, 26, 52] as const;
const WEATHER_RULES: WeatherRulePreset[] = [
  {
    id: 'base',
    label: 'Base rain rule',
    mode: 'rain_2mm_workdays',
    medium: 2,
    high: 3,
    explanationEn: 'High risk when 3+ workdays in a week have at least 2mm rain.',
    explanationNl: 'Hoog risico bij 3+ werkdagen per week met minimaal 2mm regen.',
  },
  {
    id: 'heavy',
    label: 'Heavy rain rule',
    mode: 'heavy_5mm_workdays',
    medium: 1,
    high: 2,
    explanationEn: 'High risk when 2+ workdays have 5mm or more rain.',
    explanationNl: 'Hoog risico bij 2+ werkdagen met 5mm regen of meer.',
  },
  {
    id: 'site',
    label: 'Site disruption rule',
    mode: 'bad_workdays',
    medium: 1,
    high: 2,
    explanationEn: 'High risk when 2+ workdays meet the operational bad-weather definition.',
    explanationNl: 'Hoog risico bij 2+ werkdagen volgens de operationele slecht-weer definitie.',
  },
];

export default function CfoPage() {
  const { scenario, company } = useDashboardState();
  const [horizonWeeks, setHorizonWeeks] = useState<number>(13);
  const [weatherRuleId, setWeatherRuleId] = useState<WeatherRulePreset['id']>('base');
  const [covenantFloor, setCovenantFloor] = useState(750000);
  const [language, setLanguage] = useState<CfoLanguage>('en');
  const [week, setWeek] = useState<string | null>(null);
  const weatherRule = WEATHER_RULES.find((r) => r.id === weatherRuleId) ?? WEATHER_RULES[0];
  const agentOverrides: Partial<ForecastParams> = {
    horizonWeeks,
    weatherRiskMode: weatherRule.mode,
    weatherMediumThreshold: weatherRule.medium,
    weatherHighThreshold: weatherRule.high,
    covenantFloorOverride: covenantFloor,
  };
  const forecastExtra = buildForecastExtra(agentOverrides);
  const { result, companies, error } = useForecast(company, scenario, forecastExtra);

  if (error) {
    return (
      <Card title="Data unavailable">
        <p className="text-sm text-ink-muted">{error}</p>
        <p className="mt-2 text-2xs text-ink-faint">Run the pipeline: <code>npm run pipeline</code></p>
      </Card>
    );
  }
  if (!result) return <LoadingBlock label={`Computing ${horizonWeeks}-week forecast...`} />;

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

      <ForecastControlBar
        horizonWeeks={horizonWeeks}
        onHorizonChange={setHorizonWeeks}
        weatherRuleId={weatherRuleId}
        onWeatherRuleChange={setWeatherRuleId}
        covenantFloor={covenantFloor}
        onCovenantFloorChange={setCovenantFloor}
        language={language}
        onLanguageChange={setLanguage}
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
          language={language}
          horizonWeeks={activeHorizon}
          weatherRule={weatherRule}
          covenantFloor={threshold}
        />
        <MiniDataAgent
          company={company}
          scenario={scenario}
          overrides={agentOverrides}
          language={language}
        />
      </div>

      {/* risk-first: surface the eight weather-to-cash risk signals before the charts */}
      <RiskOverview company={company} scenario={scenario} extra={forecastExtra} horizonWeeks={activeHorizon} />

      <Card title={`${activeHorizon}-week cash-in / cash-out & closing cash`} subtitle="Bars = weekly flows · line = closing cash · shaded = live-forecast weeks">
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
          <Card title={`Company comparison — net cash (${activeHorizon}wk)`} subtitle="Click a bar's company in the selector to drill in">
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
        Cash-in = facturation collected on a debtor-payment profile. Cash-out drivers, opening cash and covenant
        floors are configurable assumptions (revenue-only source data). See{' '}
        <a className="text-accent underline" href={`/methodology?company=${company}`}>Methodology</a> and{' '}
        <a className="text-accent underline" href="/data-quality">Data Quality</a>.
      </p>

      <TracePanel company={company} scenario={scenario} week={week} onClose={() => setWeek(null)} extra={forecastExtra} />
    </div>
  );
}

function buildForecastExtra(overrides: Partial<ForecastParams>) {
  const sp = new URLSearchParams();
  if (overrides.horizonWeeks != null) sp.set('horizonWeeks', String(overrides.horizonWeeks));
  if (overrides.weatherRiskMode) sp.set('weatherRiskMode', overrides.weatherRiskMode);
  if (overrides.weatherMediumThreshold != null) sp.set('weatherMediumThreshold', String(overrides.weatherMediumThreshold));
  if (overrides.weatherHighThreshold != null) sp.set('weatherHighThreshold', String(overrides.weatherHighThreshold));
  if (overrides.covenantFloorOverride != null) sp.set('covenantFloor', String(overrides.covenantFloorOverride));
  const q = sp.toString();
  return q ? `&${q}` : '';
}

function ForecastControlBar({
  horizonWeeks,
  onHorizonChange,
  weatherRuleId,
  onWeatherRuleChange,
  covenantFloor,
  onCovenantFloorChange,
  language,
  onLanguageChange,
}: {
  horizonWeeks: number;
  onHorizonChange: (weeks: number) => void;
  weatherRuleId: WeatherRulePreset['id'];
  onWeatherRuleChange: (id: WeatherRulePreset['id']) => void;
  covenantFloor: number;
  onCovenantFloorChange: (floor: number) => void;
  language: CfoLanguage;
  onLanguageChange: (language: CfoLanguage) => void;
}) {
  return (
    <Card
      title="Forecast controls"
      subtitle="Live weather is the operating basis; these controls change horizon, bad-weather definition and warning floor."
      right={<Pill tone="live">No CFO scenario picker</Pill>}
    >
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.45fr_0.8fr_0.55fr]">
        <ControlGroup label="Cashflow horizon">
          <div className="grid grid-cols-3 gap-1">
            {HORIZON_OPTIONS.map((weeks) => (
              <button
                key={weeks}
                type="button"
                data-testid={`horizon-${weeks}`}
                onClick={() => onHorizonChange(weeks)}
                className={controlButton(weeks === horizonWeeks)}
              >
                {weeks}w
              </button>
            ))}
          </div>
        </ControlGroup>

        <ControlGroup label="Bad-weather logic">
          <div className="grid gap-1 md:grid-cols-3">
            {WEATHER_RULES.map((rule) => (
              <button
                key={rule.id}
                type="button"
                data-testid={`weather-rule-${rule.id}`}
                onClick={() => onWeatherRuleChange(rule.id)}
                className={clsx(controlButton(rule.id === weatherRuleId), 'min-h-11 text-left')}
                title={rule.explanationEn}
              >
                <span className="block text-xs font-semibold">{rule.label}</span>
                <span className="block text-[10px] font-normal text-current opacity-70">
                  high {'>='} {rule.high}
                </span>
              </button>
            ))}
          </div>
        </ControlGroup>

        <ControlGroup label="Warning floor">
          <div className="flex items-center rounded-md border border-panel-line bg-panel px-2 py-1.5 focus-within:ring-2 focus-within:ring-accent/30">
            <span className="mr-1 text-xs text-ink-faint">€</span>
            <input
              aria-label="Warning floor"
              type="number"
              min={0}
              step={50000}
              value={covenantFloor}
              onChange={(e) => onCovenantFloorChange(Math.max(0, Number(e.target.value) || 0))}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none tnum"
            />
          </div>
        </ControlGroup>

        <ControlGroup label="Language">
          <div className="grid grid-cols-2 gap-1">
            {(['en', 'nl'] as const).map((lng) => (
              <button
                key={lng}
                type="button"
                data-testid={`language-${lng}`}
                onClick={() => onLanguageChange(lng)}
                className={controlButton(language === lng)}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
        </ControlGroup>
      </div>
    </Card>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </div>
  );
}

function controlButton(active: boolean) {
  return clsx(
    'rounded-md border px-2.5 py-2 text-center text-xs font-semibold transition-colors',
    active
      ? 'border-ink bg-ink text-white'
      : 'border-panel-line bg-panel-sunken text-ink-muted hover:border-accent/40 hover:text-accent',
  );
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
