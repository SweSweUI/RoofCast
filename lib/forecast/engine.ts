import type {
  Company,
  Covenant,
  ForecastKpis,
  ForecastParams,
  ForecastResult,
  ForecastWeek,
  RiskLevel,
  Scenario,
  TraceLink,
  WeatherWeek,
  WeeklyFinancial,
} from '../types';
import { addWeeksKey, isoWeekOf, type WeekKey } from './dates';
import { buildSeasonalProfile } from './seasonality';
import { buildWeatherSeries, type WeatherSeriesItem } from './weather';

export interface ForecastInput {
  company: Company;
  history: WeeklyFinancial[]; // ascending by week
  weather: WeatherWeek[]; // weather_weekly for the company's proxy location
  covenants: Covenant[];
  params: ForecastParams; // resolved (incl. startWeek, openingCash, weatherIntensity)
  scenario: Scenario;
}

const r0 = (x: number) => Math.round(x);
const r2 = (x: number) => Math.round(x * 100) / 100;
const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const LEVEL: RiskLevel[] = ['low', 'medium', 'high'];

function eur(x: number): string {
  const v = Math.round(x);
  return `€${v.toLocaleString('en-US')}`;
}

/**
 * Core forecast. Pure function — no DB, no I/O — so it is fully unit-testable.
 *
 * Pipeline: production (seasonal baseline) → weather timing shift → billing →
 * payment-lag cash-in; cash-out from driver %s on the (weather-adjusted)
 * production with their own lags. Carry-in from the weeks *before* the horizon
 * is seeded from actuals so week 1 is realistic.
 */
export function computeCompanyForecast(input: ForecastInput): ForecastResult {
  const { company, history, weather, params, scenario, covenants } = input;
  const H = params.horizonWeeks;
  const start = params.startWeek;

  const profile = buildSeasonalProfile(history, params.baselineLookbackWeeks);
  const wx = buildWeatherSeries(weather, start, H, params.weatherIntensity, {
    weatherRiskMode: params.weatherRiskMode,
    weatherMediumThreshold: params.weatherMediumThreshold,
    weatherHighThreshold: params.weatherHighThreshold,
  });

  // index w: 1 = startWeek (current week). week key = addWeeksKey(start, w-1).
  const keyOf = (w: number): WeekKey => addWeeksKey(start, w - 1);
  const baselineProd = (w: number): number => {
    const k = keyOf(w);
    return profile.level * profile.seasonalIndex(isoWeekOf(k));
  };

  const payLen = params.paymentLagWeights.length - 1; // 8
  const driverMaxLag = Math.max(...Object.values(params.driverLagWeeks));
  const preLag = Math.max(payLen, driverMaxLag); // weeks of history needed for carry-in
  const catchMax = params.catchUpStartLag + params.catchUpWeights.length - 1;

  // production maps over integer week index
  const baseProd = new Map<number, number>();
  const adjProd = new Map<number, number>();
  for (let w = 1 - preLag; w <= H + catchMax; w++) {
    if (w <= 0) {
      const actual = profile.actual.get(keyOf(w));
      const v = actual ?? baselineProd(w);
      baseProd.set(w, v);
      adjProd.set(w, v);
    } else if (w <= H) {
      const v = baselineProd(w);
      baseProd.set(w, v);
      adjProd.set(w, v);
    } else {
      baseProd.set(w, 0);
      adjProd.set(w, 0);
    }
  }

  // --- weather timing shift on future production ---------------------------
  const shiftOutByWeek = new Map<number, number>();
  let spillBeyondHorizon = 0;
  for (const item of wx) {
    const w = item.weekIndex;
    const share =
      item.risk === 'high'
        ? params.weatherShiftHigh
        : item.risk === 'medium'
          ? params.weatherShiftMedium
          : 0;
    if (share <= 0) continue;
    const shiftOut = (baseProd.get(w) ?? 0) * share;
    shiftOutByWeek.set(w, shiftOut);
    adjProd.set(w, (adjProd.get(w) ?? 0) - shiftOut);
    params.catchUpWeights.forEach((cw, k) => {
      const target = w + params.catchUpStartLag + k;
      adjProd.set(target, (adjProd.get(target) ?? 0) + shiftOut * cw);
      if (target > H) spillBeyondHorizon += shiftOut * cw;
    });
  }

  // --- billing + cash-in (payment-lag convolution) -------------------------
  const cashIn = (w: number, useAdjusted: boolean): number => {
    let total = 0;
    for (let lag = 0; lag <= payLen; lag++) {
      const src = w - lag;
      const fact = (useAdjusted ? adjProd.get(src) : baseProd.get(src)) ?? 0;
      total += fact * params.paymentLagWeights[lag];
    }
    return total;
  };

  // --- cash-out (drivers on adjusted production, with driver lags) ----------
  const driverKeys = ['materials', 'subcontractor', 'labour', 'overhead'] as const;
  const cashOutDrivers = (w: number) => {
    const out = { materials: 0, subcontractor: 0, labour: 0, overhead: 0 };
    for (const d of driverKeys) {
      const src = w - params.driverLagWeeks[d];
      out[d] = (adjProd.get(src) ?? 0) * params.drivers[d];
    }
    return out;
  };

  // company min-cash covenant (if any)
  const cashCov = covenants.find(
    (c) => c.metric === 'min_cash_balance' && c.companyId === company.id,
  );
  const threshold = params.covenantFloorOverride ?? cashCov?.threshold ?? null;

  // --- assemble weeks ------------------------------------------------------
  const weeks: ForecastWeek[] = [];
  const trace: Record<string, TraceLink[]> = {};
  let closing = params.openingCash;

  for (const item of wx) {
    const w = item.weekIndex;
    const key = item.weekStart;
    const fcCashIn = cashIn(w, true);
    const blCashIn = cashIn(w, false);
    const drivers = cashOutDrivers(w);
    const fcCashOut = drivers.materials + drivers.subcontractor + drivers.labour + drivers.overhead;
    const net = fcCashIn - fcCashOut;
    closing += net;

    const weatherAdj = fcCashIn - blCashIn;
    const billedThisWeek = adjProd.get(w) ?? 0;
    const paymentLagAdj = fcCashIn - billedThisWeek;
    const headroom = threshold == null ? null : closing - threshold;
    const shiftOut = shiftOutByWeek.get(w) ?? 0;

    // risk: liquidity-driven, with weather able to lift a calm week to medium
    let liqRank = 0;
    if (headroom != null) {
      if (headroom < 0) liqRank = 2;
      else if (threshold != null && headroom < 0.25 * threshold) liqRank = 1;
    }
    const finalRank = Math.max(liqRank, item.risk === 'high' ? 1 : 0);
    const riskLevel = LEVEL[finalRank];

    // Forecast confidence: live-weather weeks are more certain than seasonal,
    // high-weather weeks add uncertainty, and confidence decays with horizon.
    const confidence = Math.max(
      45,
      Math.min(
        95,
        (item.isLive ? 88 : 70) -
          (item.risk === 'high' ? 8 : item.risk === 'medium' ? 4 : 0) -
          Math.max(0, w - 3) * 1.5,
      ),
    );

    weeks.push({
      weekIndex: w,
      weekStart: key,
      isLiveWeather: item.isLive,
      weatherSource: item.source,
      expectedRainWorkdays: item.expectedRainWorkdays,
      weatherRiskBasis: item.riskBasis,
      weatherRiskValue: item.riskValue,
      weatherRisk: item.risk,
      delayScore: item.delayScore,
      baselineProduction: r0(baseProd.get(w) ?? 0),
      adjustedProduction: r0(adjProd.get(w) ?? 0),
      baselineCashIn: r0(blCashIn),
      forecastCashIn: r0(fcCashIn),
      forecastCashOut: r0(fcCashOut),
      drivers: {
        materials: r0(drivers.materials),
        subcontractor: r0(drivers.subcontractor),
        labour: r0(drivers.labour),
        overhead: r0(drivers.overhead),
      },
      weatherAdjustment: r0(weatherAdj),
      paymentLagAdjustment: r0(paymentLagAdj),
      netCashFlow: r0(net),
      closingCash: r0(closing),
      covenantHeadroom: headroom == null ? null : r0(headroom),
      riskLevel,
      confidence: Math.round(confidence),
      explanation: buildExplanation({
        key,
        item,
        fcCashIn,
        blCashIn,
        weatherAdj,
        shiftOut,
        fcCashOut,
        closing,
        headroom,
        scenario,
        catchUpStartLag: params.catchUpStartLag,
        catchMax,
      }),
    });

    trace[key] = buildTrace({
      blCashIn,
      weatherAdj,
      paymentLagAdj,
      drivers,
      item,
      shiftOut,
      params,
      catchMax,
    });
  }

  const kpis = buildKpis(weeks);
  return {
    scenario,
    companyId: company.id,
    companyName: company.shortName || company.name,
    weeks,
    trace,
    kpis,
    covenants,
    params,
  };
}

// --------------------------------------------------------------------------- //
function buildExplanation(a: {
  key: string;
  item: WeatherSeriesItem;
  fcCashIn: number;
  blCashIn: number;
  weatherAdj: number;
  shiftOut: number;
  fcCashOut: number;
  closing: number;
  headroom: number | null;
  scenario: Scenario;
  catchUpStartLag: number;
  catchMax: number;
}): string {
  const parts: string[] = [];
  parts.push(`Week ${a.key}: forecast cash-in ${eur(a.fcCashIn)} (baseline ${eur(a.blCashIn)}).`);
  const live = a.item.isLive ? 'live Open-Meteo forecast' : 'seasonal climatology';
  if (a.item.risk === 'low') {
    parts.push(
      `Weather: ${a.item.riskValue} ${a.item.riskBasis} (${live}) → low delay risk.`,
    );
  } else {
    parts.push(
      `Weather: ${a.item.riskValue} ${a.item.riskBasis} (${live}) → ${a.item.risk} delay risk; ` +
        `${eur(a.shiftOut)} of this week's billing shifted to weeks +${a.catchUpStartLag}…+${a.catchMax}.`,
    );
  }
  if (Math.abs(a.weatherAdj) >= 1000) {
    const dir = a.weatherAdj < 0 ? 'reduces' : 'adds (catch-up)';
    parts.push(`Net weather effect ${dir} cash-in by ${eur(Math.abs(a.weatherAdj))}.`);
  }
  parts.push(
    `Cash-out ${eur(a.fcCashOut)} (materials/subcontractor/labour/overhead). Closing cash ${eur(a.closing)}` +
      (a.headroom == null ? '.' : `, covenant headroom ${eur(a.headroom)}.`),
  );
  parts.push(
    a.scenario === 'base'
      ? 'Forecast basis: live weather operating forecast.'
      : `Forecast basis: internal ${a.scenario.replace('_', ' ')} stress test.`,
  );
  return parts.join(' ');
}

function buildTrace(a: {
  blCashIn: number;
  weatherAdj: number;
  paymentLagAdj: number;
  drivers: { materials: number; subcontractor: number; labour: number; overhead: number };
  item: WeatherSeriesItem;
  shiftOut: number;
  params: ForecastParams;
  catchMax: number;
}): TraceLink[] {
  const links: TraceLink[] = [
    {
      driver: 'baseline_cash_in',
      contributionAmount: r0(a.blCashIn),
      adjustmentReason:
        'Collections from baseline facturation (8-week deseasonalised run-rate × ISO-week seasonal index), ' +
        'spread over the debtor-payment profile (peak ≈ t+4 weeks).',
    },
  ];
  if (a.item.risk !== 'low' || Math.abs(a.weatherAdj) >= 1) {
    links.push({
      driver: 'weather_delay',
      contributionAmount: r0(a.weatherAdj),
      adjustmentReason:
        `${a.item.riskValue} ${a.item.riskBasis} → ${a.item.risk} delay risk ` +
        `(${a.item.isLive ? 'live forecast' : 'seasonal'}). Timing shift of work/billing into ` +
        `weeks +${a.params.catchUpStartLag}…+${a.catchMax}; suggestive signal, not causal (p≈0.065).`,
    });
  }
  links.push({
    driver: 'payment_lag',
    contributionAmount: r0(a.paymentLagAdj),
    adjustmentReason:
      'Difference between cash collected and work billed this week — debtor days ≈ 30–45 (configurable).',
  });
  const reasons: Record<string, string> = {
    materials: `Materials outflow ${pct(a.params.drivers.materials)} of production, paid ≈ ${a.params.driverLagWeeks.materials} wks later.`,
    subcontractor: `Subcontractor outflow ${pct(a.params.drivers.subcontractor)} of production, paid ≈ ${a.params.driverLagWeeks.subcontractor} wks later.`,
    labour: `Direct labour ${pct(a.params.drivers.labour)} of production, paid same week.`,
    overhead: `Overhead ${pct(a.params.drivers.overhead)} of production, paid same week.`,
  };
  for (const d of ['materials', 'subcontractor', 'labour', 'overhead'] as const) {
    links.push({
      driver: d,
      contributionAmount: -r0(a.drivers[d]),
      adjustmentReason: reasons[d],
    });
  }
  return links;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function buildKpis(weeks: ForecastWeek[]): ForecastKpis {
  const totalCashIn = weeks.reduce((s, w) => s + w.forecastCashIn, 0);
  const totalCashOut = weeks.reduce((s, w) => s + w.forecastCashOut, 0);
  let min = Infinity;
  let minWeek = weeks[0]?.weekStart ?? '';
  for (const w of weeks) {
    if (w.closingCash < min) {
      min = w.closingCash;
      minWeek = w.weekStart;
    }
  }
  return {
    totalCashIn: r0(totalCashIn),
    totalCashOut: r0(totalCashOut),
    netCashFlow: r0(totalCashIn - totalCashOut),
    minClosingCash: r0(min),
    minClosingWeek: minWeek,
    endingCash: weeks.length ? weeks[weeks.length - 1].closingCash : 0,
    weeksAtRisk: weeks.filter((w) => w.riskLevel !== 'low').length,
    covenantBreach: weeks.some((w) => w.covenantHeadroom != null && w.covenantHeadroom < 0),
    liveWeatherWeeks: weeks.filter((w) => w.isLiveWeather).length,
  };
}
