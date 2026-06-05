'use client';
import { useState } from 'react';
import { useDashboardState, useApi } from '@/lib/client/hooks';
import { useForecast } from '@/lib/client/forecast';
import { SCENARIO_LABELS } from '@/lib/types';
import { SCENARIO_NOTE } from '@/lib/forecast/config';
import { eur, signedEur, weekRange, weekShort } from '@/lib/format';
import {
  AssumptionTag,
  Card,
  LoadingBlock,
  Pill,
  RiskBadge,
  SectionTitle,
  Td,
  Th,
} from '@/components/ui';
import { WeekTable } from '@/components/WeekTable';
import { TracePanel } from '@/components/TracePanel';
import { WeatherCalendar } from '@/components/charts/WeatherCalendar';
import type { WeatherCell } from '@/components/charts/WeatherCalendar';
import type { ForecastWeek, RiskLevel } from '@/lib/types';

// ─── Weather API shape ───────────────────────────────────────────────────────

interface WeatherSeries {
  weekStart: string;
  weekIndex: number;
  isLive: boolean;
  source: string;
  expectedRainWorkdays: number;
  delayScore: number;
  risk: RiskLevel;
}

interface WeatherResponse {
  company: { code: string; name: string; location: string };
  series: WeatherSeries[];
  recentHistory: WeatherSeries[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Human-readable "Mon d – Sun d Mon" range for a week. */
function weekEndDate(weekStart: string): string {
  try {
    const d = new Date(weekStart);
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    return end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

/** Short hint for what a bad-weather week typically means on a construction site. */
function badWeatherNote(risk: RiskLevel, rainDays: number): string {
  if (risk === 'high') {
    if (rainDays >= 4) return 'Likely full stand-down; roofing / facade work halted.';
    return 'Probable partial stand-down; crane, roofing, concrete work at risk.';
  }
  return 'Reduced productivity; plan around wet periods where possible.';
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { scenario, company: rawCompany } = useDashboardState();
  // Single-company view: fall back to 'ummels' when portfolio selected.
  const company = rawCompany === 'portfolio' ? 'ummels' : rawCompany;

  const [week, setWeek] = useState<string | null>(null);

  const { result, loading: forecastLoading, error: forecastError } = useForecast(company, scenario);

  const weatherApi = useApi<WeatherResponse>(
    `/api/weather?company=${encodeURIComponent(company)}&scenario=${scenario}`,
  );

  // ── Error / loading states ─────────────────────────────────────────────
  if (forecastError) {
    return (
      <Card title="Data unavailable">
        <p className="text-sm text-ink-muted">{forecastError}</p>
        <p className="mt-2 text-2xs text-ink-faint">
          Run the pipeline: <code>npm run pipeline</code>
        </p>
      </Card>
    );
  }
  if (!result) return <LoadingBlock label="Computing 13-week forecast…" />;

  // ── Derived data ───────────────────────────────────────────────────────
  const weatherSeries: WeatherCell[] = weatherApi.data?.series ?? [];
  const location = weatherApi.data?.company.location ?? result.companyName;
  const companyName = weatherApi.data?.company.name ?? result.companyName;
  const liveWeeks = weatherSeries.filter((s) => s.isLive).length;

  // Bad-weather windows: high first, then medium, sorted by weekStart
  const badWeatherRows = weatherSeries
    .filter((s) => s.risk === 'high' || s.risk === 'medium')
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Weeks with material billing-timing shift (abs >= 1000)
  const shiftedWeeks = result.weeks
    .filter((w) => Math.abs(w.weatherAdjustment) >= 1000)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Next 4 weeks for indicative milestone billing
  const next4Weeks = result.weeks.slice(0, 4);

  return (
    <div className="space-y-5">
      {/* ── 1. Header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle
          sub={`${location} · ${SCENARIO_LABELS[scenario]} scenario · next 13 weeks`}
        >
          Project Lead — {companyName} weather &amp; schedule
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          {liveWeeks > 0 && (
            <Pill tone="live" title={SCENARIO_NOTE[scenario]}>
              {liveWeeks} live Open-Meteo {liveWeeks === 1 ? 'week' : 'weeks'} · then seasonal
            </Pill>
          )}
          <Pill tone="muted">execution view</Pill>
        </div>
      </div>

      {/* ── 2. Weather calendar (centrepiece) ────────────────────────── */}
      <Card
        title="13-week weather-risk calendar"
        subtitle="Green = low rain risk · amber = medium · red = high · click a week to trace billing impact"
      >
        {weatherApi.loading && weatherSeries.length === 0 ? (
          <LoadingBlock label="Fetching weather forecast…" />
        ) : weatherSeries.length === 0 ? (
          <p className="text-sm text-ink-muted">Weather data unavailable for this company.</p>
        ) : (
          <WeatherCalendar series={weatherSeries} onPick={setWeek} activeWeek={week ?? undefined} />
        )}
      </Card>

      {/* ── 3. Upcoming bad-weather windows ──────────────────────────── */}
      <Card
        title="Upcoming bad-weather windows"
        subtitle="Weeks with medium or high rain risk — plan stand-downs and subcontractor schedules"
      >
        {badWeatherRows.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No high-risk or medium-risk weather windows in the 13-week horizon. All weeks forecast
            as low rain risk.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <Th>Week</Th>
                  <Th>Risk</Th>
                  <Th right>Rain workdays</Th>
                  <Th right>Delay score</Th>
                  <Th>Source</Th>
                  <Th>Site note</Th>
                </tr>
              </thead>
              <tbody>
                {badWeatherRows.map((s) => (
                  <tr
                    key={s.weekStart}
                    className="cursor-pointer hover:bg-panel-sunken"
                    onClick={() => setWeek(s.weekStart)}
                  >
                    <Td>
                      <div className="font-medium text-ink">{weekRange(s.weekStart)}</div>
                      <div className="text-2xs text-ink-faint">W{s.weekIndex}</div>
                    </Td>
                    <Td>
                      <RiskBadge level={s.risk} />
                    </Td>
                    <Td right>
                      <span className="tnum font-semibold text-ink">{s.expectedRainWorkdays}</span>
                      <span className="ml-1 text-2xs text-ink-faint">days</span>
                    </Td>
                    <Td right>
                      <span className="tnum">{s.delayScore.toFixed(2)}</span>
                    </Td>
                    <Td>
                      {s.isLive ? (
                        <Pill tone="live">live</Pill>
                      ) : (
                        <Pill tone="muted">seasonal</Pill>
                      )}
                    </Td>
                    <Td className="text-2xs text-ink-muted">
                      {badWeatherNote(s.risk, s.expectedRainWorkdays)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── 4. Forecasted schedule & billing delay ───────────────────── */}
      <Card
        title="Forecasted schedule & billing delay"
        subtitle="Weeks where weather materially shifts billing timing — cash-in moves, not total work"
        right={<AssumptionTag>model output</AssumptionTag>}
      >
        <p className="mb-3 text-sm text-ink-soft leading-relaxed">
          When rain delays execution, milestone completion slips → invoicing is deferred → cash-in
          arrives later. The model estimates a catch-up window of{' '}
          <span className="font-medium text-ink">+4 to +7 weeks</span> where delayed production
          typically reappears. This is a{' '}
          <AssumptionTag>suggestive signal</AssumptionTag>, not a guarantee.
        </p>
        {shiftedWeeks.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No weeks with material weather-timing shifts (threshold: ±€1,000) in this horizon.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <Th>Week</Th>
                  <Th>Weather risk</Th>
                  <Th right>Billing shift</Th>
                  <Th>Catch-up window</Th>
                  <Th>Direction</Th>
                </tr>
              </thead>
              <tbody>
                {shiftedWeeks.map((w) => (
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
                      <div className="flex items-center gap-1.5">
                        <RiskBadge level={w.weatherRisk} />
                        {w.isLiveWeather ? (
                          <Pill tone="live">live</Pill>
                        ) : (
                          <Pill tone="muted">seasonal</Pill>
                        )}
                      </div>
                    </Td>
                    <Td right>
                      <span
                        className={
                          w.weatherAdjustment < 0 ? 'font-semibold text-risk-high tnum' : 'font-semibold text-risk-low tnum'
                        }
                      >
                        {signedEur(w.weatherAdjustment)}
                      </span>
                    </Td>
                    <Td className="text-2xs text-ink-muted">
                      {w.weatherAdjustment < 0
                        ? '+4 to +7 weeks (catch-up)'
                        : 'absorbed from prior delay'}
                    </Td>
                    <Td>
                      {w.weatherAdjustment < 0 ? (
                        <span className="text-2xs text-risk-high">billing deferred →</span>
                      ) : (
                        <span className="text-2xs text-risk-low">← catch-up received</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── 5. Next invoice / milestone logic ────────────────────────── */}
      <Card
        title="Next invoice / milestone logic"
        subtitle="Indicative billing cadence derived from historical transaction patterns — not a project plan"
        right={<AssumptionTag>assumption</AssumptionTag>}
      >
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-medium text-amber-800">
            No project-level WIP or milestone data is available.
          </p>
          <p className="mt-1 text-2xs text-amber-700 leading-relaxed">
            The expected billing figures below are derived from historical facturation patterns
            (same ISO weeks in prior years + recent trailing average), adjusted for weather timing
            by the forecast model. Treat as an indicative signal, not a confirmed invoicing
            schedule. <AssumptionTag />
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr>
                <Th>Week</Th>
                <Th right>Expected billing</Th>
                <Th>Weather risk</Th>
                <Th>Action hint</Th>
              </tr>
            </thead>
            <tbody>
              {next4Weeks.map((w) => (
                <tr
                  key={w.weekStart}
                  className="cursor-pointer hover:bg-panel-sunken"
                  onClick={() => setWeek(w.weekStart)}
                >
                  <Td>
                    <div className="font-medium text-ink">{weekRange(w.weekStart)}</div>
                    <div className="text-2xs text-ink-faint">W{w.weekIndex}</div>
                  </Td>
                  <Td right>
                    <span className="tnum font-semibold text-ink">{eur(w.baselineProduction)}</span>
                  </Td>
                  <Td>
                    <RiskBadge level={w.weatherRisk} />
                  </Td>
                  <Td className="text-2xs">
                    {w.weatherRisk === 'high' ? (
                      <span className="text-risk-high font-medium">hold if wet — milestone likely slips</span>
                    ) : w.weatherRisk === 'medium' ? (
                      <span className="text-risk-medium">{'bill if >50% complete; watch rain window'}</span>
                    ) : (
                      <span className="text-risk-low">bill if dry — favourable conditions</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 6. Weekly detail & traceability ──────────────────────────── */}
      <Card
        title="Weekly detail & traceability"
        subtitle="Full 13-week forecast — click any week to trace back to drivers, assumptions and source transactions"
      >
        <WeekTable weeks={result.weeks} onPick={setWeek} showHeadroom={false} />
      </Card>

      {/* ── 7. Footnote ──────────────────────────────────────────────── */}
      <p className="text-2xs text-ink-faint leading-relaxed">
        No project-level data supplied. Schedule and billing signals are derived from historical
        transaction patterns and weather timing model — clearly{' '}
        <AssumptionTag>assumptions</AssumptionTag>. Weather delay → execution → milestone →
        billing → cash-in chain is a model estimate with high uncertainty at individual-week
        level. Catch-up signals are indicative only. See{' '}
        <a className="text-accent underline" href="/methodology">
          methodology
        </a>
        .
      </p>

      {/* ── TracePanel (drawer) ───────────────────────────────────────── */}
      <TracePanel
        company={company}
        scenario={scenario}
        week={week}
        onClose={() => setWeek(null)}
      />
    </div>
  );
}
