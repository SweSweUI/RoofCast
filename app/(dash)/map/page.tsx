'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApi, useDashboardState } from '@/lib/client/hooks';
import { SCENARIO_LABELS, type MapCompanyMarker, type MapResponse, type RiskLevel } from '@/lib/types';
import { dateShort, eurCompact, signedEur } from '@/lib/format';
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
import { RealWeatherMap } from '@/components/RealWeatherMap';

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export default function MapPage() {
  const { scenario } = useDashboardState();
  const { data, loading, error } = useApi<MapResponse>(`/api/map?scenario=${scenario}`);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  if (error) {
    return (
      <Card title="Map data unavailable">
        <p className="text-sm text-ink-muted">{error}</p>
        <p className="mt-2 text-2xs text-ink-faint">Run the pipeline: <code>npm run pipeline</code></p>
      </Card>
    );
  }
  if (!data && loading) return <LoadingBlock label="Building location risk map..." />;
  if (!data) return null;

  const markers = [...data.markers].sort((a, b) => {
    const riskDiff = RANK[b.riskLevel] - RANK[a.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return b.deferredCashImpact - a.deferredCashImpact;
  });
  const selected = markers.find((marker) => marker.code === selectedCode) ?? markers[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle
          sub={`${SCENARIO_LABELS[scenario]}${data.startWeek ? ` - 13 weeks from ${dateShort(data.startWeek)}` : ''}`}
        >
          Map - Location Weather Risk
        </SectionTitle>
        <Pill tone="accent">Open-Meteo proxies and forecast engine output</Pill>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Portfolio map risk" value={data.portfolio.riskLevel} tone={toneForRisk(data.portfolio.riskLevel)} sub={`${data.portfolio.highRiskMarkers} high markers`} />
        <Kpi label="Locations" value={`${data.portfolio.companies}`} sub={`${data.portfolio.companiesWithProxyLocations} proxy assumptions`} />
        <Kpi label="Weather timing impact" value={eurCompact(data.portfolio.estimatedWeatherCashImpact)} sub={signedEur(data.portfolio.estimatedWeatherCashImpact)} tone={data.portfolio.estimatedWeatherCashImpact < 0 ? 'bad' : 'default'} />
        <Kpi label="Deferred by weather" value={eurCompact(data.portfolio.deferredCashImpact)} sub="negative weekly shifts" tone={data.portfolio.deferredCashImpact > 0 ? 'warn' : 'good'} />
        <Kpi label="Medium markers" value={`${data.portfolio.mediumRiskMarkers}`} sub="cash or weather risk" />
        <Kpi label="Source" value="Live + seasonal" sub="per location" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
        <Card
          title="Company pins and local weather forecast"
          subtitle="OpenStreetMap pins. Marker color combines weather-delay and cash/liquidity risk; exact project coordinates can be added later."
          pad={false}
        >
          <div className="relative">
            <RealWeatherMap markers={markers} selectedCode={selected?.code ?? null} onSelect={setSelectedCode} />
            <div className="absolute bottom-8 left-3 z-[500] rounded-md border border-panel-line bg-white/90 px-3 py-2 text-2xs text-ink-muted shadow-card">
              <div className="mb-1 font-semibold text-ink">Risk legend</div>
              <div className="flex flex-wrap gap-2">
                <RiskBadge level="high" />
                <RiskBadge level="medium" />
                <RiskBadge level="low" />
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={selected ? selected.shortName : 'Select marker'}
          subtitle={selected?.locationName ?? 'No marker selected'}
          right={selected?.isAssumption ? <AssumptionTag>proxy</AssumptionTag> : undefined}
        >
          {selected ? <MarkerDetail marker={selected} /> : <p className="text-sm text-ink-muted">No markers available.</p>}
        </Card>
      </div>

      <Card
        title="Location risk table"
        subtitle="Company-level weather proxies. Project-level coordinates can be added later without changing the marker contract."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Location</Th>
                <Th>Risk</Th>
                <Th right>Rain workdays</Th>
                <Th right>Deferred</Th>
                <Th right>Weather impact</Th>
                <Th right>Min closing</Th>
                <Th>Source</Th>
              </tr>
            </thead>
            <tbody>
              {markers.map((marker) => (
                <tr
                  key={marker.code}
                  className="cursor-pointer hover:bg-panel-sunken"
                  onClick={() => setSelectedCode(marker.code)}
                >
                  <Td>
                    <div className="font-medium text-ink">{marker.shortName}</div>
                    <div className="text-2xs text-ink-faint">{marker.sourceSystem ?? 'Unknown source system'}</div>
                  </Td>
                  <Td>
                    <div>{marker.locationName ?? 'No location'}</div>
                    {marker.isAssumption && <div className="mt-0.5"><AssumptionTag>proxy</AssumptionTag></div>}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <RiskBadge level={marker.riskLevel} />
                      <RiskBadge level={marker.weatherRisk} label={`Wx ${marker.weatherRisk}`} />
                    </div>
                  </Td>
                  <Td right>{marker.currentWeekRainWorkdays.toFixed(1)}</Td>
                  <Td right>{eurCompact(marker.deferredCashImpact)}</Td>
                  <Td right>
                    <span className={marker.estimatedWeatherCashImpact < 0 ? 'text-risk-high' : 'text-ink-soft'}>
                      {signedEur(marker.estimatedWeatherCashImpact)}
                    </span>
                  </Td>
                  <Td right>{eurCompact(marker.minClosingCash)}</Td>
                  <Td className="text-2xs text-ink-muted">{marker.weatherSource}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MarkerDetail({ marker }: { marker: MapCompanyMarker }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Combined risk" value={marker.riskLevel} tone={toneForRisk(marker.riskLevel)} sub={`${marker.weeksAtRisk}/13 weeks at risk`} />
        <Kpi label="Weather risk" value={marker.weatherRisk} tone={toneForRisk(marker.weatherRisk)} sub={`${marker.highRiskWeeks} high, ${marker.mediumRiskWeeks} medium`} />
        <Kpi label="Deferred cash" value={eurCompact(marker.deferredCashImpact)} tone={marker.deferredCashImpact > 0 ? 'warn' : 'good'} sub="timing only" />
        <Kpi label="Worst week" value={signedEur(marker.worstWeeklyWeatherImpact)} tone={marker.worstWeeklyWeatherImpact < 0 ? 'bad' : 'default'} sub={marker.nextRiskWeek ? dateShort(marker.nextRiskWeek) : 'no risk week'} />
      </div>

      <dl className="space-y-2 text-sm">
        <DetailRow label="Weather source" value={marker.weatherSource} />
        <DetailRow label="Current week rain" value={`${marker.currentWeekRainWorkdays.toFixed(1)} expected rain workdays`} />
        <DetailRow label="Location note" value={marker.locationNote ?? 'No note'} />
        <DetailRow label="Coordinates" value={`${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)}`} />
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-soft"
          href={`/opco?company=${encodeURIComponent(marker.code)}`}
        >
          Open Opco view
        </Link>
        <Link
          className="rounded-md border border-panel-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-panel-sunken"
          href={`/project?company=${encodeURIComponent(marker.code)}`}
        >
          Open Project view
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <dt className="text-2xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-ink-soft">{value}</dd>
    </div>
  );
}

function toneForRisk(risk: RiskLevel): 'default' | 'good' | 'warn' | 'bad' {
  if (risk === 'high') return 'bad';
  if (risk === 'medium') return 'warn';
  return 'good';
}
