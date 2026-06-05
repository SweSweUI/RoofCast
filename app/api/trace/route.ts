import { analogWeeks, computeForecast, computePortfolio } from '@/lib/forecast';
import { getAnalogTransactions, getCompanyByCode, getWeeklyFinancials } from '@/lib/queries';
import { jsonError, parseOverrides, parseScenario } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const scenario = parseScenario(sp);
    const code = sp.get('company') ?? 'ummels';
    const weekParam = sp.get('week');
    const overrides = parseOverrides(sp);

    // Portfolio-level trace: per-company net contributions to the week.
    if (code === 'portfolio') {
      const { portfolio } = computePortfolio(scenario, overrides);
      const week = portfolio.weeks.find((w) => w.weekStart === weekParam) ?? portfolio.weeks[0];
      return Response.json({
        company: { code: 'portfolio', name: 'Portfolio' },
        scenario,
        week,
        trace: portfolio.trace[week.weekStart] ?? [],
        analogWeeks: [],
        transactions: [],
      });
    }

    const co = getCompanyByCode(code);
    if (!co) return Response.json({ error: 'unknown_company' }, { status: 404 });

    const r = computeForecast(scenario, co.id, overrides);
    const week = r.weeks.find((w) => w.weekStart === weekParam) ?? r.weeks[0];
    const history = getWeeklyFinancials(co.id);
    const analog = analogWeeks(history, week.weekStart);
    const transactions = getAnalogTransactions(co.id, analog, 12);

    return Response.json({
      company: { code: co.code, name: co.shortName },
      scenario,
      week,
      trace: r.trace[week.weekStart] ?? [],
      analogWeeks: analog,
      transactions,
    });
  } catch (e) {
    return jsonError(e);
  }
}
