import type {
  Company,
  ForecastParams,
  ForecastResult,
  ForecastWeek,
  RiskLevel,
  Scenario,
  TraceLink,
} from '../types';
import {
  getCompanies,
  getCompaniesWithFinancials,
  getCovenants,
  getEarliestForecastWeatherWeek,
  getWeatherWeekly,
  getWeeklyFinancials,
} from '../queries';
import { computeCompanyForecast } from './engine';
import { DEFAULT_OPENING_CASH, OPENING_CASH, resolveParams } from './config';
import { currentWeekKey, type WeekKey } from './dates';

export * from './config';
export { computeCompanyForecast } from './engine';
export { buildSeasonalProfile, analogWeeks } from './seasonality';
export { buildWeatherSeries, classifyRisk } from './weather';

const WORST: RiskLevel[] = ['low', 'medium', 'high'];
const rank = (r: RiskLevel) => WORST.indexOf(r);

/** Anchor the 13-week horizon to the live-weather "current week" so the demo is
 *  coherent regardless of wall-clock: start = earliest live-forecast week. */
export async function forecastStartWeek(today = new Date()): Promise<WeekKey> {
  const w = await getEarliestForecastWeatherWeek();
  return w ?? currentWeekKey(today);
}

export async function forecastCompanies(): Promise<Company[]> {
  return getCompaniesWithFinancials();
}

export async function computeForecast(
  scenario: Scenario,
  companyId: number,
  overrides: Partial<ForecastParams> = {},
  today = new Date(),
): Promise<ForecastResult> {
  const company = (await getCompanies()).find((c) => c.id === companyId);
  if (!company) throw new Error(`Unknown company ${companyId}`);
  const [history, weather, covenants, startWeek] = await Promise.all([
    getWeeklyFinancials(companyId),
    company.weatherLocationId ? getWeatherWeekly(company.weatherLocationId) : Promise.resolve([]),
    getCovenants(companyId),
    forecastStartWeek(today),
  ]);
  const openingCash = OPENING_CASH[company.code] ?? DEFAULT_OPENING_CASH;
  const params = resolveParams(scenario, { startWeek, openingCash }, overrides);
  return computeCompanyForecast({ company, history, weather, covenants, params, scenario });
}

export interface PortfolioForecast {
  portfolio: ForecastResult;
  companies: ForecastResult[];
}

/** Aggregate the per-company forecasts into a portfolio cash view. */
export async function computePortfolio(
  scenario: Scenario,
  overrides: Partial<ForecastParams> = {},
  today = new Date(),
): Promise<PortfolioForecast> {
  const list = await forecastCompanies();
  const { covenantFloorOverride: _portfolioFloor, ...companyOverrides } = overrides;
  const companies = await Promise.all(
    list.map((c) => computeForecast(scenario, c.id, companyOverrides, today)),
  );
  const portfolioCov = (await getCovenants(null)).find((c) => c.metric === 'min_13w_liquidity');
  const threshold = overrides.covenantFloorOverride ?? portfolioCov?.threshold ?? null;

  const ref = companies[0]?.weeks ?? [];
  const weeks: ForecastWeek[] = ref.map((_, i) => {
    const slice = companies.map((c) => c.weeks[i]);
    const sum = (f: (w: ForecastWeek) => number) => slice.reduce((s, w) => s + f(w), 0);
    const closing = sum((w) => w.closingCash);
    const worstWx = slice.reduce<RiskLevel>(
      (acc, w) => (rank(w.weatherRisk) > rank(acc) ? w.weatherRisk : acc),
      'low',
    );
    const headroom = threshold == null ? null : closing - threshold;
    let liq: RiskLevel = 'low';
    if (headroom != null) {
      if (headroom < 0) liq = 'high';
      else if (threshold != null && headroom < 0.25 * threshold) liq = 'medium';
    }
    const finalRisk = WORST[Math.max(rank(liq), worstWx === 'high' ? 1 : 0)];
    const base = slice[0];
    return {
      weekIndex: base.weekIndex,
      weekStart: base.weekStart,
      isLiveWeather: base.isLiveWeather,
      weatherSource: base.weatherSource,
      expectedRainWorkdays: Math.max(...slice.map((w) => w.expectedRainWorkdays)),
      weatherRiskBasis: base.weatherRiskBasis,
      weatherRiskValue: Math.max(...slice.map((w) => w.weatherRiskValue)),
      weatherRisk: worstWx,
      delayScore: Math.round((slice.reduce((s, w) => s + w.delayScore, 0) / slice.length) * 10) / 10,
      baselineProduction: sum((w) => w.baselineProduction),
      adjustedProduction: sum((w) => w.adjustedProduction),
      baselineCashIn: sum((w) => w.baselineCashIn),
      forecastCashIn: sum((w) => w.forecastCashIn),
      forecastCashOut: sum((w) => w.forecastCashOut),
      drivers: {
        materials: sum((w) => w.drivers.materials),
        subcontractor: sum((w) => w.drivers.subcontractor),
        labour: sum((w) => w.drivers.labour),
        overhead: sum((w) => w.drivers.overhead),
      },
      weatherAdjustment: sum((w) => w.weatherAdjustment),
      paymentLagAdjustment: sum((w) => w.paymentLagAdjustment),
      netCashFlow: sum((w) => w.netCashFlow),
      closingCash: closing,
      covenantHeadroom: headroom == null ? null : Math.round(headroom),
      riskLevel: finalRisk,
      confidence: Math.round(slice.reduce((s, w) => s + w.confidence, 0) / slice.length),
      explanation:
        `Portfolio week ${base.weekStart}: cash-in ${eur(sum((w) => w.forecastCashIn))}, ` +
        `cash-out ${eur(sum((w) => w.forecastCashOut))}, closing ${eur(closing)}` +
        (headroom == null ? '.' : `, liquidity headroom ${eur(headroom)} vs covenant floor.`),
    };
  });

  // portfolio trace: each company's net contribution to the week
  const trace: Record<string, TraceLink[]> = {};
  weeks.forEach((w, i) => {
    trace[w.weekStart] = companies.map((c) => ({
      driver: c.companyName,
      contributionAmount: c.weeks[i].netCashFlow,
      adjustmentReason:
        `${c.companyName}: cash-in ${eur(c.weeks[i].forecastCashIn)} − cash-out ${eur(c.weeks[i].forecastCashOut)}` +
        ` (${c.weeks[i].weatherRisk} weather risk).`,
    }));
  });

  let min = Infinity;
  let minWeek = weeks[0]?.weekStart ?? '';
  for (const w of weeks) if (w.closingCash < min) (min = w.closingCash), (minWeek = w.weekStart);

  const portfolio: ForecastResult = {
    scenario,
    companyId: 0,
    companyName: 'Portfolio',
    weeks,
    trace,
    kpis: {
      totalCashIn: weeks.reduce((s, w) => s + w.forecastCashIn, 0),
      totalCashOut: weeks.reduce((s, w) => s + w.forecastCashOut, 0),
      netCashFlow: weeks.reduce((s, w) => s + w.netCashFlow, 0),
      minClosingCash: Math.round(min),
      minClosingWeek: minWeek,
      endingCash: weeks.length ? weeks[weeks.length - 1].closingCash : 0,
      weeksAtRisk: weeks.filter((w) => w.riskLevel !== 'low').length,
      covenantBreach: threshold != null && min < threshold,
      liveWeatherWeeks: weeks.filter((w) => w.isLiveWeather).length,
    },
    covenants: portfolioCov ? [portfolioCov] : [],
    params: { ...(companies[0]?.params as ForecastParams), covenantFloorOverride: overrides.covenantFloorOverride },
  };

  return { portfolio, companies };
}

function eur(x: number): string {
  return `€${Math.round(x).toLocaleString('en-US')}`;
}
