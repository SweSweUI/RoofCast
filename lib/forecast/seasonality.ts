import type { WeeklyFinancial } from '../types';
import { isoWeekOf, type WeekKey } from './dates';

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface SeasonalProfile {
  /** deseasonalised weekly production run-rate (€) */
  level: number;
  /** ISO-week-of-year -> multiplicative seasonal index */
  seasonalIndex: (woy: number) => number;
  /** actual weekly production (gross facturation) by week key */
  actual: Map<WeekKey, number>;
  overallMean: number;
}

/**
 * Classic multiplicative seasonal decomposition over the company's weekly gross
 * facturation. `level` is the recent deseasonalised run-rate; `seasonalIndex`
 * re-applies the ISO-week shape to each future week.
 */
export function buildSeasonalProfile(
  history: WeeklyFinancial[],
  lookback: number,
): SeasonalProfile {
  const prod = history.map((h) => ({ week: h.weekStart, value: Math.max(0, h.creditTotal) }));
  const overallMean = mean(prod.map((p) => p.value)) || 1;

  const byWoy = new Map<number, number[]>();
  for (const p of prod) {
    const w = isoWeekOf(p.week);
    (byWoy.get(w) ?? byWoy.set(w, []).get(w)!).push(p.value);
  }
  const idx = new Map<number, number>();
  for (const [w, arr] of byWoy) idx.set(w, clamp(mean(arr) / overallMean, 0.25, 2.5));
  const seasonalIndex = (woy: number) => idx.get(woy) ?? 1.0;

  const recentSlice = prod.slice(-lookback);
  const deseason = recentSlice.map((p) => p.value / seasonalIndex(isoWeekOf(p.week)));
  const level = median(deseason) || overallMean;

  const actual = new Map(prod.map((p) => [p.week, p.value] as const));
  return { level, seasonalIndex, actual, overallMean };
}

/** Historical weeks that inform a future week's baseline: same ISO week in prior
 *  years plus the most recent `lookback` actual weeks. Used for traceability. */
export function analogWeeks(
  history: WeeklyFinancial[],
  futureWeek: WeekKey,
  lookback = 8,
): WeekKey[] {
  const woy = isoWeekOf(futureWeek);
  const sameWoy = history.filter((h) => isoWeekOf(h.weekStart) === woy).map((h) => h.weekStart);
  const recent = history.slice(-lookback).map((h) => h.weekStart);
  return Array.from(new Set([...sameWoy, ...recent]));
}
