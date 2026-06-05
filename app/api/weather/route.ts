import { computeForecast } from '@/lib/forecast';
import { getCompanyByCode, getWeatherWeekly } from '@/lib/queries';
import { jsonError, parseOverrides, parseScenario } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const scenario = parseScenario(sp);
    const code = sp.get('company') ?? 'ummels';
    const co = await getCompanyByCode(code);
    if (!co) return Response.json({ error: 'unknown_company' }, { status: 404 });

    const r = await computeForecast(scenario, co.id, parseOverrides(sp));
    const series = r.weeks.map((w) => ({
      weekStart: w.weekStart,
      weekIndex: w.weekIndex,
      isLive: w.isLiveWeather,
      source: w.weatherSource,
      expectedRainWorkdays: w.expectedRainWorkdays,
      delayScore: w.delayScore,
      risk: w.weatherRisk,
    }));
    const recentHistory = co.weatherLocationId
      ? (await getWeatherWeekly(co.weatherLocationId)).filter((w) => !w.isForecast).slice(-16)
      : [];

    return Response.json({
      company: {
        code: co.code,
        name: co.shortName,
        location: co.locationName,
        weatherLocationId: co.weatherLocationId,
      },
      scenario,
      series,
      recentHistory,
    });
  } catch (e) {
    return jsonError(e);
  }
}
