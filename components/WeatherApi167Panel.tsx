'use client';

import type { WeatherApi167Detail } from '@/lib/types';
import { LoadingBlock, Pill, Td, Th } from './ui';

export function WeatherApi167Panel({
  detail,
  loading,
}: {
  detail: WeatherApi167Detail | null | undefined;
  loading?: boolean;
}) {
  if (loading && !detail) return <LoadingBlock label="Loading live weather details..." />;
  if (!detail) {
    return <p className="text-sm text-ink-muted">No extra live-weather detail available for this location.</p>;
  }

  const current = detail.current;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={detail.provider === 'rapidapi-weather-api167' ? 'accent' : 'muted'}>
            {detail.providerLabel}
          </Pill>
          {detail.timezone && <span className="text-2xs text-ink-faint">{detail.timezone}</span>}
        </div>
        {!detail.rapidApiConfigured && (
          <span className="text-2xs text-ink-faint">Set WEATHER_API167_RAPIDAPI_KEY to route through RapidAPI.</span>
        )}
      </div>

      {detail.error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
          {detail.error}
        </div>
      )}

      {current ? (
        <div className="grid gap-3 md:grid-cols-4">
          <WeatherMetric label="Now" value={current.condition ?? 'Unknown'} sub={formatTime(current.time)} />
          <WeatherMetric label="Temperature" value={formatTemp(current.temperature)} sub={`feels ${formatTemp(current.feelsLike)}`} />
          <WeatherMetric label="Rain / clouds" value={`${formatMm(current.precipitation)} rain`} sub={`${formatPct(current.cloudCover)} cloud cover`} />
          <WeatherMetric label="Wind / humidity" value={formatWind(current.windSpeed, current.windDirectionText)} sub={`${formatPct(current.humidity)} humidity`} />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Current conditions unavailable from Weather API 167.</p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-x-auto">
          <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">Next 12 hours</div>
          <table className="w-full min-w-[420px]">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Condition</Th>
                <Th right>Temp</Th>
                <Th right>Rain prob.</Th>
              </tr>
            </thead>
            <tbody>
              {detail.hourly.slice(0, 6).map((row) => (
                <tr key={row.time}>
                  <Td>{formatTime(row.time)}</Td>
                  <Td>{row.condition ?? 'n/a'}</Td>
                  <Td right>{formatTemp(row.temperature)}</Td>
                  <Td right>{formatPct(row.precipitationProbability)}</Td>
                </tr>
              ))}
              {detail.hourly.length === 0 && (
                <tr><Td colSpan={4} className="py-3 text-center text-ink-faint">No hourly rows</Td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">Daily outlook</div>
          <table className="w-full min-w-[420px]">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Condition</Th>
                <Th right>Low / high</Th>
                <Th right>Rain</Th>
              </tr>
            </thead>
            <tbody>
              {detail.daily.slice(0, 5).map((row) => (
                <tr key={row.date}>
                  <Td>{formatDate(row.date)}</Td>
                  <Td>{row.condition ?? 'n/a'}</Td>
                  <Td right>{formatTemp(row.tempMin)} / {formatTemp(row.tempMax)}</Td>
                  <Td right>{formatMm(row.precipitation)}</Td>
                </tr>
              ))}
              {detail.daily.length === 0 && (
                <tr><Td colSpan={4} className="py-3 text-center text-ink-faint">No daily rows</Td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail.airQuality && (
        <div className="rounded-md bg-panel-sunken px-3 py-2 text-sm text-ink-soft">
          Air quality: <span className="font-semibold text-ink">{detail.airQuality.category ?? 'n/a'}</span>
          {detail.airQuality.usAqi != null && <span className="tnum"> · US AQI {detail.airQuality.usAqi}</span>}
          {detail.airQuality.pm25 != null && <span className="tnum"> · PM2.5 {detail.airQuality.pm25}</span>}
          {detail.airQuality.pm10 != null && <span className="tnum"> · PM10 {detail.airQuality.pm10}</span>}
        </div>
      )}
    </div>
  );
}

function WeatherMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-panel-sunken px-3 py-2">
      <div className="text-2xs font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-2xs text-ink-muted">{sub}</div>}
    </div>
  );
}

function formatTime(value: string | null) {
  if (!value) return 'n/a';
  return value.includes('T') ? value.split('T')[1]?.slice(0, 5) ?? value : value;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTemp(value: number | null) {
  return value == null ? 'n/a' : `${Math.round(value)}°C`;
}

function formatPct(value: number | null) {
  return value == null ? 'n/a' : `${Math.round(value)}%`;
}

function formatMm(value: number | null) {
  return value == null ? 'n/a' : `${value.toFixed(value >= 10 ? 0 : 1)} mm`;
}

function formatWind(speed: number | null, direction: string | null) {
  if (speed == null) return 'n/a';
  return `${Math.round(speed)} km/h${direction ? ` ${direction}` : ''}`;
}
