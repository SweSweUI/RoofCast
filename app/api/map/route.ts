import { computeForecast, forecastCompanies } from '@/lib/forecast';
import { getWeatherLocations } from '@/lib/queries';
import type { ForecastResult, MapCompanyMarker, MapResponse, RiskLevel } from '@/lib/types';
import { jsonError, parseOverrides, parseScenario } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const maxRisk = (...levels: RiskLevel[]): RiskLevel =>
  levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'low' as RiskLevel);

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const scenario = parseScenario(sp);
    const overrides = parseOverrides(sp);
    const [companies, weatherLocations] = await Promise.all([
      forecastCompanies(),
      getWeatherLocations(),
    ]);
    const weatherById = new Map(weatherLocations.map((w: any) => [Number(w.id), w]));

    const results: ForecastResult[] = await Promise.all(
      companies.map((company) => computeForecast(scenario, company.id, overrides)),
    );

    const markers: MapCompanyMarker[] = results.flatMap((result) => {
      const company = companies.find((c) => c.id === result.companyId);
      if (!company) return [];
      const weatherLocation = company.weatherLocationId == null
        ? null
        : weatherById.get(company.weatherLocationId) ?? null;
      const latitude = company.latitude ?? (weatherLocation?.latitude == null ? null : Number(weatherLocation.latitude));
      const longitude = company.longitude ?? (weatherLocation?.longitude == null ? null : Number(weatherLocation.longitude));
      if (latitude == null || longitude == null) return [];

      const weeks = result.weeks;
      const weatherRisk = weeks.reduce<RiskLevel>((risk, week) => maxRisk(risk, week.weatherRisk), 'low');
      const cashRisk = weeks.reduce<RiskLevel>((risk, week) => maxRisk(risk, week.riskLevel), 'low');
      const currentWeek = weeks[0];
      const nextWeatherRisk = weeks.find((week) => week.weatherRisk !== 'low');
      const nextCashRisk = weeks.find((week) => week.riskLevel !== 'low');
      const liveWeatherWeeks = weeks.filter((week) => week.isLiveWeather).length;
      const deferredCashImpact = weeks.reduce((sum, week) => sum + Math.max(0, -week.weatherAdjustment), 0);
      const estimatedWeatherCashImpact = weeks.reduce((sum, week) => sum + week.weatherAdjustment, 0);
      const worstWeeklyWeatherImpact = weeks.reduce((worst, week) =>
        Math.abs(week.weatherAdjustment) > Math.abs(worst) ? week.weatherAdjustment : worst, 0);

      const weatherSource = liveWeatherWeeks === weeks.length
        ? 'live Open-Meteo forecast'
        : liveWeatherWeeks === 0
          ? 'seasonal climatology'
          : `${liveWeatherWeeks} live Open-Meteo weeks, ${weeks.length - liveWeatherWeeks} seasonal weeks`;

      return [{
        id: company.id,
        code: company.code,
        name: company.name,
        shortName: company.shortName,
        sourceSystem: company.sourceSystem,
        sourceConfidence: company.sourceConfidence,
        locationName: company.locationName,
        latitude,
        longitude,
        weatherLocationId: company.weatherLocationId,
        isAssumption: Boolean(company.isAssumption),
        locationNote: weatherLocation?.notes ?? company.notes,
        riskLevel: maxRisk(weatherRisk, cashRisk),
        weatherRisk,
        cashRisk,
        currentWeekRisk: currentWeek?.weatherRisk ?? 'low',
        currentWeekRainWorkdays: currentWeek?.expectedRainWorkdays ?? 0,
        liveWeatherWeeks,
        mediumRiskWeeks: weeks.filter((week) => week.weatherRisk === 'medium').length,
        highRiskWeeks: weeks.filter((week) => week.weatherRisk === 'high').length,
        nextRiskWeek: nextWeatherRisk?.weekStart ?? nextCashRisk?.weekStart ?? null,
        weatherSource,
        estimatedWeatherCashImpact: Math.round(estimatedWeatherCashImpact),
        deferredCashImpact: Math.round(deferredCashImpact),
        worstWeeklyWeatherImpact: Math.round(worstWeeklyWeatherImpact),
        minClosingCash: result.kpis.minClosingCash,
        weeksAtRisk: result.kpis.weeksAtRisk,
        weeks: weeks.map((week) => ({
          weekStart: week.weekStart,
          risk: week.weatherRisk,
          rainValue: week.weatherRiskValue,
          rainBasis: week.weatherRiskBasis,
          isLive: week.isLiveWeather,
        })),
      }];
    });

    const portfolioRisk = markers.reduce<RiskLevel>((risk, marker) => maxRisk(risk, marker.riskLevel), 'low');
    const response: MapResponse = {
      scenario,
      startWeek: results[0]?.weeks[0]?.weekStart ?? null,
      generatedAt: new Date().toISOString(),
      markers,
      portfolio: {
        riskLevel: portfolioRisk,
        companies: markers.length,
        companiesWithProxyLocations: markers.filter((marker) => marker.isAssumption).length,
        highRiskMarkers: markers.filter((marker) => marker.riskLevel === 'high').length,
        mediumRiskMarkers: markers.filter((marker) => marker.riskLevel === 'medium').length,
        estimatedWeatherCashImpact: Math.round(markers.reduce((sum, marker) => sum + marker.estimatedWeatherCashImpact, 0)),
        deferredCashImpact: Math.round(markers.reduce((sum, marker) => sum + marker.deferredCashImpact, 0)),
      },
    };

    return Response.json(response);
  } catch (e) {
    return jsonError(e);
  }
}
