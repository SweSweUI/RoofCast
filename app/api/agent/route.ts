import { computeForecast, computePortfolio } from '@/lib/forecast';
import { getCompanyByCode, getInventory, getStatsArtifact } from '@/lib/queries';
import { SCENARIOS, type ForecastResult, type ForecastWeek, type Scenario } from '@/lib/types';
import { eur, eurCompact, signedEur, dateShort } from '@/lib/format';
import { jsonError } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AgentRequest {
  question?: string;
  company?: string;
  scenario?: Scenario;
}

export async function GET() {
  return Response.json({
    examples: [
      'Why is cash lower in week 5?',
      'Which company is most exposed to weather?',
      'How much cash is deferred by bad weather?',
      'How does the live forecast affect cash?',
      'What accounting APIs can we connect?',
    ],
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgentRequest;
    const question = String(body.question ?? '').trim();
    const scenario = body.scenario && SCENARIOS.includes(body.scenario) ? body.scenario : 'base';
    const companyCode = body.company ?? 'portfolio';
    if (!question) return Response.json({ error: 'question_required' }, { status: 400 });

    const [forecast, companies, inventory, stats] = await Promise.all([
      resolveForecast(companyCode, scenario),
      computePortfolio(scenario),
      getInventory(),
      getStatsArtifact('stats.json'),
    ]);

    const result = forecast.result;
    const cohort = companyCode === 'portfolio' ? companies.companies : [result];
    const answer = buildAnswer(question, result, cohort, inventory, stats);

    return Response.json({
      company: companyCode,
      scenario,
      generatedAt: new Date().toISOString(),
      ...answer,
    });
  } catch (e) {
    return jsonError(e);
  }
}

async function resolveForecast(company: string, scenario: Scenario): Promise<{ result: ForecastResult }> {
  if (company === 'portfolio') {
    return { result: (await computePortfolio(scenario)).portfolio };
  }
  const co = await getCompanyByCode(company);
  if (!co) throw new Error(`Unknown company ${company}`);
  return { result: await computeForecast(scenario, co.id) };
}

function buildAnswer(
  rawQuestion: string,
  result: ForecastResult,
  companies: ForecastResult[],
  inventory: any,
  stats: any,
) {
  const q = rawQuestion.toLowerCase();
  const deferred = result.weeks.reduce((sum, week) => sum + Math.max(0, -week.weatherAdjustment), 0);
  const netWeather = result.weeks.reduce((sum, week) => sum + week.weatherAdjustment, 0);
  const riskWeeks = result.weeks.filter((week) => week.riskLevel !== 'low');

  if (mentions(q, ['scenario', 'wet', 'dry', 'sensitivity', 'forecast'])) {
    return {
      answer:
        'The live forecast is the operating answer. The CFO flow no longer asks users to choose wet/base/dry.',
      bullets: [
        `${result.kpis.liveWeatherWeeks}/13 weeks use live Open-Meteo weather; the remaining weeks use seasonal climatology.`,
        `Current forecast net weather cash timing impact is ${signedEur(netWeather)} over the horizon.`,
        'Internal stress-test variants can stay in the model for audit/testing, but they are not a CFO selection workflow.',
      ],
      sources: ['forecast_weeks', 'weather_weekly', 'forecast params: live forecast + seasonal climatology'],
    };
  }

  if (mentions(q, ['connect', 'connector', 'api', 'accounting', 'accountancy', 'exact', 'snelstart', 'gilde'])) {
    return {
      answer:
        'The app now has connector metadata for major accounting routes. Credentials stay server-side; the UI should only show safe status metadata.',
      bullets: [
        'Ready connector tracks: Exact Online, SnelStart, Gilde/import, AFAS, Twinfield, Moneybird, QuickBooks, Xero, Microsoft Business Central, NetSuite, SAP Business One, Sage, Visma, Yuki, and manual Excel/import.',
        'Current demo data still comes from uploaded/exported files unless a connector is configured.',
        'A production connector would sync source files, accounts, transactions, invoices, debtor terms, and eventually AP/bank balances.',
      ],
      sources: ['connector registry', 'source_files', 'data_inventory'],
    };
  }

  if (mentions(q, ['which company', 'most exposed', 'worst company', 'highest risk', 'company exposed'])) {
    const ranked = [...companies]
      .map((company) => ({
        name: company.companyName,
        deferred: company.weeks.reduce((sum, week) => sum + Math.max(0, -week.weatherAdjustment), 0),
        weatherWeeks: company.weeks.filter((week) => week.weatherRisk !== 'low').length,
        weeksAtRisk: company.kpis.weeksAtRisk,
        minClosing: company.kpis.minClosingCash,
      }))
      .sort((a, b) => b.deferred - a.deferred || b.weeksAtRisk - a.weeksAtRisk);
    const top = ranked[0];
    return {
      answer: `${top.name} is currently the largest weather-timing exposure in this forecast.`,
      bullets: ranked.slice(0, 4).map((row) =>
        `${row.name}: ${eurCompact(row.deferred)} deferred by weather, ${row.weatherWeeks} weather-risk weeks, min closing ${eurCompact(row.minClosing)}.`,
      ),
      sources: ['forecast_weeks.weather_adjustment', 'forecast_weeks.risk_level', 'companies'],
    };
  }

  if (mentions(q, ['weather', 'rain', 'wet', 'bad workday', 'bad-weather'])) {
    const rows = result.weeks
      .filter((week) => week.weatherRisk !== 'low' || Math.abs(week.weatherAdjustment) > 1000)
      .slice(0, 6);
    return {
      answer: rows.length
        ? 'These are the main weather-driven timing signals in the current forecast.'
        : 'No material weather-timing signal is visible in the current horizon.',
      bullets: rows.map((week) =>
        `${dateShort(week.weekStart)}: ${week.weatherRisk} weather risk, ${week.expectedRainWorkdays} rain workdays, weather cash timing ${signedEur(week.weatherAdjustment)} (${week.weatherSource}).`,
      ),
      sources: ['weather_weekly', 'forecast_weeks.weather_adjustment', 'Open-Meteo'],
    };
  }

  if (mentions(q, ['why', 'week', 'cash lower', 'cash low', 'headroom'])) {
    const week = pickWeek(rawQuestion, result.weeks);
    return {
      answer: `For ${dateShort(week.weekStart)}, closing cash is ${eur(week.closingCash)} and net cash flow is ${signedEur(week.netCashFlow)}.`,
      bullets: [
        `Cash-in: ${eur(week.forecastCashIn)} versus baseline ${eur(week.baselineCashIn)}.`,
        `Weather timing effect: ${signedEur(week.weatherAdjustment)} with ${week.expectedRainWorkdays} rain workdays and ${week.weatherRisk} weather risk.`,
        `Cash-out: ${eur(week.forecastCashOut)}. Covenant headroom: ${week.covenantHeadroom == null ? 'not configured' : signedEur(week.covenantHeadroom)}.`,
        week.explanation,
      ],
      sources: ['forecast_weeks', 'trace_links', 'forecast engine explanation'],
    };
  }

  if (mentions(q, ['assumption', 'data quality', 'source', 'missing'])) {
    const missing = inventory?.missing_fields ?? [];
    const files = inventory?.files_loaded ?? inventory?.files?.length ?? 'unknown';
    const rows = inventory?.rows_loaded ?? 'unknown';
    return {
      answer: 'The forecast is auditable, but several cash-flow inputs are still assumptions because the source data is billing/revenue-led.',
      bullets: [
        `Loaded ${files} source files and ${rows} transaction rows.`,
        ...missing.slice(0, 5),
        `Weather lag stats remain suggestive, not causal. Headline Ummels lag-5 p-value: ${stats?.companies?.ummels?.wetdry?.find?.((r: any) => r.lag === 5)?.p_value ?? 'see stats page'}.`,
      ],
      sources: ['data_inventory.json', 'stats.json', 'source_files', 'assumptions'],
    };
  }

  const worstWeek = result.weeks.reduce((min, week) => (week.closingCash < min.closingCash ? week : min), result.weeks[0]);
  return {
    answer: `${result.companyName} forecast summary: net cash ${signedEur(result.kpis.netCashFlow)}, minimum closing cash ${eur(result.kpis.minClosingCash)} in the week of ${dateShort(result.kpis.minClosingWeek)}.`,
    bullets: [
      `${riskWeeks.length}/13 weeks have medium or high risk.`,
      `Weather defers ${eurCompact(deferred)} of cash timing; net in-horizon weather impact is ${signedEur(netWeather)}.`,
      `Lowest closing-cash week is ${dateShort(worstWeek.weekStart)} with ${eur(worstWeek.closingCash)} closing cash.`,
      'Try asking: "which company is most exposed", "why is week 5 lower", or "what data is missing".',
    ],
    sources: ['forecast_weeks', 'weather_weekly', 'covenants'],
  };
}

function mentions(question: string, words: string[]) {
  return words.some((word) => question.includes(word));
}

function pickWeek(question: string, weeks: ForecastWeek[]) {
  const match = question.match(/\b(?:week|w)\s*(\d{1,2})\b/i);
  const idx = match ? Number(match[1]) : NaN;
  if (Number.isFinite(idx) && idx >= 1 && idx <= weeks.length) return weeks[idx - 1];
  return weeks.reduce((min, week) => (week.closingCash < min.closingCash ? week : min), weeks[0]);
}
