import { DEFAULT_PARAMS, computeForecast, computePortfolio, forecastCompanies } from '@/lib/forecast';
import { computeRiskSignals, type RiskContext } from '@/lib/forecast/risks';
import { getCompanyByCode, getInventory, getWeeklyFinancials } from '@/lib/queries';
import type { Company, ForecastResult } from '@/lib/types';
import { jsonError, parseOverrides, parseScenario } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const scenario = parseScenario(sp);
    const overrides = parseOverrides(sp);
    const company = sp.get('company') ?? 'portfolio';
    const isPortfolio = company === 'portfolio';

    let result: ForecastResult;
    let co: Company | undefined;
    let cohort: Company[];
    // payment-stress: debtor profile shifted +2 weeks later
    const shifted = [0, 0, ...DEFAULT_PARAMS.paymentLagWeights];
    let stressCashIn: number;

    if (isPortfolio) {
      result = (await computePortfolio(scenario, overrides)).portfolio;
      stressCashIn = (await computePortfolio(scenario, { ...overrides, paymentLagWeights: shifted })).portfolio.kpis.totalCashIn;
      cohort = await forecastCompanies();
    } else {
      co = await getCompanyByCode(company);
      if (!co) return Response.json({ error: 'unknown_company', company }, { status: 404 });
      result = await computeForecast(scenario, co.id, overrides);
      stressCashIn = (await computeForecast(scenario, co.id, { ...overrides, paymentLagWeights: shifted })).kpis.totalCashIn;
      cohort = [co];
    }

    // covenant floor
    const cov = result.covenants.find((c) => c.metric === 'min_cash_balance')
      ?? result.covenants.find((c) => c.metric === 'min_13w_liquidity');
    const threshold = result.params.covenantFloorOverride ?? cov?.threshold ?? null;

    // reconciliation variance (only Opco A has a monthly summary)
    const inv = await getInventory();
    const recon: any[] = inv?.reconciliation ?? [];
    const relevant = isPortfolio ? recon : recon.filter((r) => r.company_id === co!.id);
    const variances = relevant
      .filter((r) => r.monthly_summary_netto)
      .map((r) => (r.weekly_credit_total - r.monthly_summary_netto) / r.monthly_summary_netto);
    const reconWorst = variances.length ? variances.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0) : null;

    // underperformance + thin history (recent 8 wks vs prior 18 wks)
    const underperformers: { name: string; pct: number; eur: number }[] = [];
    let thinHistory = false;
    for (const c of cohort) {
      const h = await getWeeklyFinancials(c.id);
      if (h.length < 26) {
        thinHistory = true;
        continue;
      }
      const recent = mean(h.slice(-8).map((x) => x.creditTotal));
      const prior = mean(h.slice(-26, -8).map((x) => x.creditTotal));
      if (prior > 0) {
        const pct = (recent - prior) / prior;
        if (pct < -0.03) underperformers.push({ name: c.shortName, pct, eur: (recent - prior) * result.weeks.length });
      }
    }

    const ctx: RiskContext = {
      isPortfolio,
      threshold,
      driverTotalPct: Object.values(result.params.drivers).reduce((a, b) => a + b, 0),
      paymentStressCashIn: stressCashIn,
      reconWorstVariancePct: reconWorst,
      thinHistory,
      underperformers,
    };

    const signals = computeRiskSignals(result, ctx);
    return Response.json({
      company,
      scenario,
      meanConfidence: Math.round(mean(result.weeks.map((w) => w.confidence))),
      signals,
      weekConfidence: result.weeks.map((w) => ({
        weekStart: w.weekStart,
        weekIndex: w.weekIndex,
        confidence: w.confidence,
        isLive: w.isLiveWeather,
        riskLevel: w.riskLevel,
        weatherRisk: w.weatherRisk,
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
