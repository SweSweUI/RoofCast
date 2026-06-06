import { computeForecast, computePortfolio } from '@/lib/forecast';
import { getCompanyByCode } from '@/lib/queries';
import { SCENARIOS } from '@/lib/types';
import type { ForecastResult, Scenario } from '@/lib/types';
import { jsonError, parseOverrides } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Internal stress-test comparison endpoint. The operating dashboard uses the
 *  live forecast basis and does not expose this as a CFO selection workflow. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const overrides = parseOverrides(sp);
    const company = sp.get('company') ?? 'portfolio';

    const co = company === 'portfolio' ? null : await getCompanyByCode(company);
    if (company !== 'portfolio' && !co) {
      return Response.json({ error: 'unknown_company', company }, { status: 404 });
    }

    const out: Record<string, unknown> = {};
    for (const s of SCENARIOS as Scenario[]) {
      const r: ForecastResult =
        co == null ? (await computePortfolio(s, overrides)).portfolio : await computeForecast(s, co.id, overrides);
      out[s] = {
        weeks: r.weeks.map((w) => ({
          weekStart: w.weekStart,
          weekIndex: w.weekIndex,
          closingCash: w.closingCash,
          netCashFlow: w.netCashFlow,
          forecastCashIn: w.forecastCashIn,
          forecastCashOut: w.forecastCashOut,
        })),
        kpis: r.kpis,
      };
    }
    return Response.json({ company, scenarios: out });
  } catch (e) {
    return jsonError(e);
  }
}
