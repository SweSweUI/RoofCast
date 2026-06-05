import type { RiskLevel, WeatherWeek } from '../types';
import { addWeeksKey, isoWeekOf, type WeekKey } from './dates';
import { mean } from './seasonality';

export interface WeatherSeriesItem {
  weekStart: WeekKey;
  weekIndex: number;
  isLive: boolean;
  source: string; // 'live-forecast' | 'seasonal'
  expectedRainWorkdays: number;
  delayScore: number;
  badWorkdays: number;
  risk: RiskLevel;
}

/** Risk tiers from the brief: 0–1 rain workdays low, 2 medium, 3+ high. */
export function classifyRisk(rainWorkdays: number): RiskLevel {
  if (rainWorkdays >= 2.5) return 'high';
  if (rainWorkdays >= 1.5) return 'medium';
  return 'low';
}

/**
 * Build the 13-week weather assumption series:
 *   - near-term weeks use the live Open-Meteo forecast (is_forecast = 1)
 *   - later weeks use ISO-week seasonal climatology from the historical record
 * The scenario weather intensity multiplier is applied only to the *seasonal*
 * weeks — the live near-term forecast is taken as known and not stressed.
 */
export function buildWeatherSeries(
  weather: WeatherWeek[],
  startWeek: WeekKey,
  horizon: number,
  intensity: number,
): WeatherSeriesItem[] {
  const live = new Map<WeekKey, WeatherWeek>();
  const climRain = new Map<number, number[]>();
  const climScore = new Map<number, number[]>();
  const climBad = new Map<number, number[]>();
  const push = (m: Map<number, number[]>, k: number, v: number) =>
    (m.get(k) ?? m.set(k, []).get(k)!).push(v);

  for (const w of weather) {
    if (w.isForecast) {
      live.set(w.weekStart, w);
    } else {
      const woy = isoWeekOf(w.weekStart);
      push(climRain, woy, w.rainDays2mm);
      push(climScore, woy, w.delayScore);
      push(climBad, woy, w.badWorkdays);
    }
  }

  const items: WeatherSeriesItem[] = [];
  for (let i = 0; i < horizon; i++) {
    const wk = addWeeksKey(startWeek, i);
    const woy = isoWeekOf(wk);
    const lv = live.get(wk);
    let rainWd: number, score: number, bad: number, isLive: boolean, source: string;
    if (lv) {
      rainWd = lv.rainDays2mm;
      score = lv.delayScore;
      bad = lv.badWorkdays;
      isLive = true;
      source = 'live-forecast';
    } else {
      rainWd = mean(climRain.get(woy) ?? []);
      score = mean(climScore.get(woy) ?? []);
      bad = mean(climBad.get(woy) ?? []);
      isLive = false;
      source = 'seasonal';
    }
    const f = isLive ? 1.0 : intensity; // stress only the seasonal portion
    rainWd *= f;
    score *= f;
    bad *= f;
    items.push({
      weekStart: wk,
      weekIndex: i + 1,
      isLive,
      source,
      expectedRainWorkdays: Math.round(rainWd * 10) / 10,
      delayScore: Math.round(score * 10) / 10,
      badWorkdays: Math.round(bad * 10) / 10,
      risk: classifyRisk(rainWd),
    });
  }
  return items;
}
