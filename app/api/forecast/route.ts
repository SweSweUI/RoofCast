import { computeForecast, computePortfolio } from '@/lib/forecast';
import { getCompanyByCode } from '@/lib/queries';
import { jsonError, parseOverrides, parseScenario } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const scenario = parseScenario(sp);
    const overrides = parseOverrides(sp);
    const company = sp.get('company') ?? 'portfolio';

    if (company === 'portfolio') {
      const { portfolio, companies } = computePortfolio(scenario, overrides);
      // strip per-company trace to keep the payload lean (fetch via /api/trace)
      const lean = companies.map((c) => ({ ...c, trace: {} }));
      return Response.json({ portfolio, companies: lean });
    }

    const co = getCompanyByCode(company);
    if (!co) return Response.json({ error: 'unknown_company', company }, { status: 404 });
    return Response.json(computeForecast(scenario, co.id, overrides));
  } catch (e) {
    return jsonError(e);
  }
}
