import type { ForecastParams, Scenario, WeatherRiskMode } from '../types';
import { DbUnavailableError } from '../db';

export function parseScenario(sp: URLSearchParams): Scenario {
  sp.get('scenario'); // accepted for backward-compatible URLs; dashboard APIs use live forecast.
  return 'base';
}

/** Parse the configurable forecast overrides exposed as dashboard controls. */
export function parseOverrides(sp: URLSearchParams): Partial<ForecastParams> {
  const o: Partial<ForecastParams> = {};
  const drivers: Partial<ForecastParams['drivers']> = {};
  const weatherRiskModes = new Set<WeatherRiskMode>([
    'rain_2mm_workdays',
    'heavy_5mm_workdays',
    'bad_workdays',
    'delay_score',
  ]);
  const numf = (k: string) => {
    const v = sp.get(k);
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  for (const d of ['materials', 'subcontractor', 'labour', 'overhead'] as const) {
    const v = numf(d);
    if (v !== undefined) drivers[d] = v;
  }
  if (Object.keys(drivers).length) o.drivers = drivers as ForecastParams['drivers'];
  const horizon = numf('horizonWeeks');
  if (horizon !== undefined) o.horizonWeeks = Math.max(4, Math.min(52, Math.round(horizon)));
  const high = numf('weatherShiftHigh');
  if (high !== undefined) o.weatherShiftHigh = high;
  const med = numf('weatherShiftMedium');
  if (med !== undefined) o.weatherShiftMedium = med;
  const riskMode = sp.get('weatherRiskMode');
  if (riskMode && weatherRiskModes.has(riskMode as WeatherRiskMode)) {
    o.weatherRiskMode = riskMode as WeatherRiskMode;
  }
  const riskHigh = numf('weatherHighThreshold');
  if (riskHigh !== undefined) o.weatherHighThreshold = riskHigh;
  const riskMedium = numf('weatherMediumThreshold');
  if (riskMedium !== undefined) o.weatherMediumThreshold = riskMedium;
  const covenantFloor = numf('covenantFloor');
  if (covenantFloor !== undefined) o.covenantFloorOverride = Math.max(0, Math.round(covenantFloor));
  const opening = numf('openingCash');
  if (opening !== undefined) o.openingCash = opening;
  const lookback = numf('baselineLookbackWeeks');
  if (lookback !== undefined) o.baselineLookbackWeeks = Math.round(lookback);
  return o;
}

export function jsonError(e: unknown): Response {
  if (e instanceof DbUnavailableError) {
    return Response.json(
      { error: 'data_unavailable', message: e.message, hint: 'Run: npm run pipeline' },
      { status: 503 },
    );
  }
  const message = e instanceof Error ? e.message : String(e);
  return Response.json({ error: 'server_error', message }, { status: 500 });
}
