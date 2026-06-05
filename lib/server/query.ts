import type { ForecastParams, Scenario } from '../types';
import { SCENARIOS } from '../types';
import { DbUnavailableError } from '../db';

export function parseScenario(sp: URLSearchParams): Scenario {
  const s = sp.get('scenario') as Scenario | null;
  return s && SCENARIOS.includes(s) ? s : 'base';
}

/** Parse the configurable forecast overrides exposed as dashboard controls. */
export function parseOverrides(sp: URLSearchParams): Partial<ForecastParams> {
  const o: Partial<ForecastParams> = {};
  const drivers: Partial<ForecastParams['drivers']> = {};
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
  const high = numf('weatherShiftHigh');
  if (high !== undefined) o.weatherShiftHigh = high;
  const med = numf('weatherShiftMedium');
  if (med !== undefined) o.weatherShiftMedium = med;
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
