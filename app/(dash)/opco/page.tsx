'use client';
import { useState } from 'react';
import { useDashboardState, useApi } from '@/lib/client/hooks';
import { pickThreshold, useForecast } from '@/lib/client/forecast';
import { SCENARIO_LABELS } from '@/lib/types';
import { SCENARIO_NOTE } from '@/lib/forecast/config';
import { eur, eurCompact, signedEur, dateShort, weekRange } from '@/lib/format';
import {
  AssumptionTag,
  Card,
  Kpi,
  LoadingBlock,
  Pill,
  RiskBadge,
  SectionTitle,
  Td,
  Th,
} from '@/components/ui';
import { WeekTable } from '@/components/WeekTable';
import { TracePanel } from '@/components/TracePanel';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { DriverSplitChart } from '@/components/charts/DriverSplitChart';
import { CovenantChart } from '@/components/charts/CovenantChart';
import { WeatherCalendar, type WeatherCell } from '@/components/charts/WeatherCalendar';
import type { ForecastWeek } from '@/lib/types';

export default function OpcoPage() {
  const { scenario, company } = useDashboardState();
  // Single-company view: default to 'ummels' if portfolio is selected
  const code = company === 'portfolio' ? 'ummels' : company;

  const { result, loading, error } = useForecast(code, scenario);
  const weatherApi = useApi<{
    company: { code: string; name: string; location: string; weatherLocationId: number };
    series: WeatherCell[];
    recentHistory: unknown[];
  }>(`/api/weather?company=${encodeURIComponent(code)}&scenario=${scenario}`);
  const companiesApi = useApi<{ companies: Array<{ code: string; name: string; locationName: string | null; sourceSystem: string | null }> }>(
    '/api/companies',
  );

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
  if (!result) return <LoadingBlock label="Computing 13-week forecast…" />;

  const k = result.kpis;
  const { threshold, label: covenantLabel } = pickThreshold(result);
  const breach = k.covenantBreach;

  // Resolve company metadata from /api/companies
  const companyMeta = companiesApi.data?.companies.find((c) => c.code === code);
  const location = companyMeta?.locationName ?? '';
  const sourceSystem = companyMeta?.sourceSystem ?? null;
  const companyName = result.companyName;

  // KPI: WIP / billing pipeline exposure proxy
  const wipExposure =
    result.weeks.slice(0, 4).reduce((s, w) => s + w.baselineProduction, 0) -
    result.weeks.slice(0, 4).reduce((s, w) => s + w.forecastCashIn, 0);

  // Min covenant headroom
  const headroomValues = result.weeks
    .map((w) => w.covenantHeadroom)
    .filter((v): v is number => v != null);
  const minHeadroom = headroomValues.length ? Math.min(...headroomValues) : null;

  const weatherSeries: WeatherCell[] = weatherApi.data?.series ?? [];

  // Operational recommendations
  const recommendations = buildRecommendations(result.weeks, threshold);

  // Top 5 weeks by abs(weatherAdjustment)
  const topRiskWeeks = [...result.weeks]
    .sort((a, b) => Math.abs(b.weatherAdjustment) - Math.abs(a.weatherAdjustment))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle
          sub={`${SCENARIO_LABELS[scenario]} · 13 weeks · ${location}`}
        >
          Opco MD — {companyName}
        </SectionTitle>
        <div className="flex items-center gap-2">
          {sourceSystem && (
            <Pill tone="muted" title="Source system for this company's data">
              {sourceSystem}
            </Pill>
          )}
          <Pill tone="accent" title={SCENARIO_NOTE[scenario]}>
            {k.liveWeatherWeeks} live-weather weeks · then seasonal
          </Pill>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Net cash (13wk)"
          value={eurCompact(k.netCashFlow)}
          tone={k.netCashFlow < 0 ? 'bad' : 'good'}
          sub={signedEur(k.netCashFlow)}
        />
        <Kpi
          label="Min closing cash"
          value={eurCompact(k.minClosingCash)}
          sub={`week of ${dateShort(k.minClosingWeek)}`}
          tone={breach ? 'bad' : 'default'}
        />
        <Kpi
          label="Covenant headroom (min)"
          value={
            minHeadroom == null
              ? 'n/a'
              : minHeadroom < 0
              ? 'Breach'
              : eurCompact(minHeadroom)
          }
          tone={minHeadroom == null ? 'default' : minHeadroom < 0 ? 'bad' : minHeadroom < (threshold ?? Infinity) * 0.25 ? 'warn' : 'good'}
          sub={threshold == null ? 'no floor set' : `floor ${eurCompact(threshold)}`}
          hint={covenantLabel}
        />
        <Kpi
          label="Weeks at risk"
          value={`${k.weeksAtRisk}/13`}
          tone={k.weeksAtRisk > 4 ? 'warn' : 'default'}
          sub="liquidity / weather"
        />
        <Kpi
          label="WIP / billing exposure"
          value={eurCompact(Math.abs(wipExposure))}
          tone="default"
          sub={
            <span className="flex items-center gap-1">
              4-wk proxy <AssumptionTag>WIP proxy</AssumptionTag>
            </span>
          }
          hint="Approximated as baseline production minus collected cash-in for the first 4 weeks. No WIP line-items in source data."
        />
        <Kpi
          label="Live-weather weeks"
          value={`${k.liveWeatherWeeks}`}
          tone="default"
          sub="Open-Meteo near-term"
        />
      </div>

      {/* Cashflow chart */}
      <Card
        title="Opco 13-week cash"
        subtitle="Bars = weekly flows · line = closing cash · shaded = live-forecast weeks"
      >
        <CashflowChart weeks={result.weeks} />
      </Card>

      {/* Driver split + Covenant */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Cash-out drivers"
          subtitle="Materials · subcontractor · labour · overhead (configurable assumptions)"
        >
          <DriverSplitChart weeks={result.weeks} />
        </Card>
        <Card
          title={`Covenant headroom — ${covenantLabel}`}
          subtitle={
            threshold == null
              ? 'No covenant floor configured'
              : `Closing cash vs floor ${eur(threshold)} (assumption)`
          }
        >
          <CovenantChart weeks={result.weeks} threshold={threshold} thresholdLabel={covenantLabel} />
        </Card>
      </div>

      {/* Weather calendar */}
      <Card
        title="Weather impact on upcoming weeks"
        subtitle="Live near-term Open-Meteo forecast · seasonal climatology for later weeks · click a week to trace"
      >
        {weatherSeries.length > 0 ? (
          <WeatherCalendar series={weatherSeries} onPick={setWeek} activeWeek={week ?? undefined} />
        ) : (
          <LoadingBlock label="Loading weather data…" />
        )}
        <p className="mt-3 text-2xs text-ink-faint">
          Live (Open-Meteo) for near-term weeks; ISO-week seasonal climatology for later weeks.
        </p>
      </Card>

      {/* Operational recommendations */}
      <Card
        title="Operational recommendations"
        subtitle="Derived from weather and liquidity signals in the 13-week forecast"
      >
        <RecommendationList items={recommendations} />
      </Card>

      {/* Project / transaction risk signals */}
      <Card
        title="Project / transaction risk signals"
        subtitle="Top 5 weeks by absolute weather-timing billing shift"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr>
                <Th>Week</Th>
                <Th>Weather risk</Th>
                <Th right>Rain workdays</Th>
                <Th right>€ billing shifted</Th>
                <Th>Liquidity risk</Th>
              </tr>
            </thead>
            <tbody>
              {topRiskWeeks.map((w) => (
                <tr
                  key={w.weekStart}
                  className="cursor-pointer hover:bg-panel-sunken"
                  onClick={() => setWeek(w.weekStart)}
                >
                  <Td>
                    <div className="font-medium text-ink">{weekRange(w.weekStart)}</div>
                    <div className="text-2xs text-ink-faint">W{w.weekIndex}</div>
                  </Td>
                  <Td>
                    <RiskBadge level={w.weatherRisk} />
                  </Td>
                  <Td right>
                    <span className="tnum">{w.expectedRainWorkdays}</span>
                  </Td>
                  <Td right>
                    <span
                      className={
                        w.weatherAdjustment < 0 ? 'text-risk-high tnum' : 'text-ink-soft tnum'
                      }
                    >
                      {signedEur(w.weatherAdjustment)}
                    </span>
                  </Td>
                  <Td>
                    <RiskBadge level={w.riskLevel} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Weekly detail + traceability */}
      <Card
        title="Weekly detail & traceability"
        subtitle="Click any week to trace the number back to drivers, assumptions and source transactions"
      >
        <WeekTable weeks={result.weeks} onPick={setWeek} />
      </Card>

      {/* Footnote */}
      <p className="text-2xs text-ink-faint">
        WIP exposure, cash-out drivers and covenant floors are configurable assumptions (revenue-only
        source data). Covenant headroom derived from closing cash vs floor. See{' '}
        <a className="text-accent underline" href={`/methodology?scenario=${scenario}&company=${code}`}>
          Methodology
        </a>{' '}
        and{' '}
        <a className="text-accent underline" href="/data-quality">
          Data Quality
        </a>
        .
      </p>

      <TracePanel company={code} scenario={scenario} week={week} onClose={() => setWeek(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRecommendations(weeks: ForecastWeek[], threshold: number | null): string[] {
  const bullets: Array<{ priority: number; text: string }> = [];

  // High weather-risk weeks in next 6
  const upcoming = weeks.slice(0, 6);
  for (const w of upcoming) {
    if (w.weatherRisk === 'high') {
      bullets.push({
        priority: 1,
        text: `Week of ${dateShort(w.weekStart)}: high weather-delay risk (${w.expectedRainWorkdays} rain workdays) — expect billing slippage of ~${eurCompact(Math.abs(w.weatherAdjustment))}; pull forward low-weather tasks and confirm material deliveries ahead of time.`,
      });
    }
  }

  // Thin liquidity headroom weeks (< 25% of threshold)
  if (threshold != null) {
    for (const w of weeks) {
      if (w.covenantHeadroom != null && w.covenantHeadroom < threshold * 0.25) {
        bullets.push({
          priority: 2,
          text: `Week of ${dateShort(w.weekStart)}: thin liquidity headroom (${signedEur(w.covenantHeadroom)} vs floor ${eurCompact(threshold)}) — tighten debtor collection and defer discretionary spend.`,
        });
      }
    }
  }

  // Medium weather-risk weeks in next 6 if not too many bullets already
  if (bullets.length < 4) {
    for (const w of upcoming) {
      if (w.weatherRisk === 'medium' && Math.abs(w.weatherAdjustment) > 5000) {
        bullets.push({
          priority: 3,
          text: `Week of ${dateShort(w.weekStart)}: moderate weather risk (${w.expectedRainWorkdays} rain workdays, ~${eurCompact(Math.abs(w.weatherAdjustment))} timing shift) — monitor closely and prepare contingency scheduling.`,
        });
      }
    }
  }

  // Positive note if nothing critical
  if (bullets.length === 0) {
    bullets.push({
      priority: 4,
      text: 'No high-priority weather or liquidity signals in the 13-week horizon. Cash position remains stable; continue standard monitoring cadence.',
    });
  }

  // Sort by priority, cap at 6
  return bullets
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6)
    .map((b) => b.text);
}

function RecommendationList({ items }: { items: string[] }) {
  if (!items.length) {
    return (
      <p className="text-sm text-ink-muted">No operational signals require action at this time.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-ink-soft">
          <span className="mt-0.5 shrink-0 text-ink-faint">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
