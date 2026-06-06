import { computeForecast, computePortfolio } from '@/lib/forecast';
import { getCompanyByCode, getInventory, getStatsArtifact } from '@/lib/queries';
import type { ForecastParams, ForecastResult, ForecastWeek, Scenario, WeatherRiskMode } from '@/lib/types';
import { eur, eurCompact, signedEur, dateShort } from '@/lib/format';
import { jsonError } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AgentRequest {
  question?: string;
  company?: string;
  scenario?: Scenario;
  overrides?: Partial<ForecastParams>;
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
    const scenario: Scenario = 'base';
    const companyCode = body.company ?? 'portfolio';
    const overrides = normaliseAgentOverrides(body.overrides);
    if (!question) return Response.json({ error: 'question_required' }, { status: 400 });

    const [forecast, companies, inventory, stats] = await Promise.all([
      resolveForecast(companyCode, scenario, overrides),
      computePortfolio(scenario, overrides),
      getInventory(),
      getStatsArtifact('stats.json'),
    ]);

    const result = forecast.result;
    const cohort = companyCode === 'portfolio' ? companies.companies : [result];

    // The rule-based answer is always computed: it is the deterministic
    // fallback and supplies the source list when the LLM is unavailable.
    const rules = buildAnswer(question, result, cohort, inventory, stats);
    const base = { company: companyCode, scenario, generatedAt: new Date().toISOString() };

    // When OpenRouter is configured, ground a real LLM answer in the SAME
    // computed numbers. On any failure, degrade gracefully to the rule answer.
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      try {
        const ai = await askOpenRouter(apiKey, question, result, cohort, inventory, stats);
        return Response.json({
          ...base,
          mode: 'ai',
          model: ai.model,
          answer: ai.answer,
          bullets: ai.bullets.length ? ai.bullets : rules.bullets,
          sources: [`AI · ${ai.model}`, ...rules.sources],
        });
      } catch (e) {
        return Response.json({ ...base, mode: 'rules', aiError: String((e as Error)?.message ?? e), ...rules });
      }
    }

    return Response.json({ ...base, mode: 'rules', ...rules });
  } catch (e) {
    return jsonError(e);
  }
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';
const WEATHER_RISK_MODES = new Set<WeatherRiskMode>([
  'rain_2mm_workdays',
  'heavy_5mm_workdays',
  'bad_workdays',
  'delay_score',
]);

function normaliseAgentOverrides(input: unknown): Partial<ForecastParams> {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const out: Partial<ForecastParams> = {};
  const numberField = (key: string) => {
    const value = raw[key];
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };

  const horizon = numberField('horizonWeeks');
  if (horizon !== undefined) out.horizonWeeks = Math.max(4, Math.min(52, Math.round(horizon)));

  const mode = raw.weatherRiskMode;
  if (typeof mode === 'string' && WEATHER_RISK_MODES.has(mode as WeatherRiskMode)) {
    out.weatherRiskMode = mode as WeatherRiskMode;
  }

  const medium = numberField('weatherMediumThreshold');
  if (medium !== undefined) out.weatherMediumThreshold = medium;
  const high = numberField('weatherHighThreshold');
  if (high !== undefined) out.weatherHighThreshold = high;
  const floor = numberField('covenantFloorOverride');
  if (floor !== undefined) out.covenantFloorOverride = Math.max(0, Math.round(floor));

  return out;
}

/**
 * Ask an OpenRouter-hosted model the user's question, grounded strictly in the
 * real forecast numbers. Returns a structured {answer, bullets}. Throws on any
 * transport/parse error so the caller can fall back to the rule-based answer.
 */
async function askOpenRouter(
  apiKey: string,
  question: string,
  result: ForecastResult,
  companies: ForecastResult[],
  inventory: any,
  stats: any,
): Promise<{ model: string; answer: string; bullets: string[] }> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const context = buildContext(result, companies, inventory, stats);

  const system = [
    'You are the financial analyst for Altis, a weather-aware cashflow',
    'forecasting platform for PE-backed roofing companies.',
    'Answer the user question using ONLY the figures in the DATA block.',
    'Cite exact euro amounts and week dates from the data; never invent numbers.',
    'If the data does not cover the question, say so plainly.',
    'Respond ONLY with minified JSON: {"answer": string, "bullets": string[]}.',
    'answer = 1-2 sentence direct response. bullets = 2-4 short points, each with a concrete figure.',
  ].join(' ');

  const user = `QUESTION:\n${question}\n\nDATA (real computed forecast, euros):\n${context}`;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://altis.app',
      'X-Title': 'Altis Cashflow Agent',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('OpenRouter returned no content');

  let answer = content.trim();
  let bullets: string[] = [];
  // Some models wrap the JSON in a ```json fence or add stray prose despite
  // response_format — extract the JSON object before parsing.
  const fenced = answer.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const open = fenced.indexOf('{');
  const close = fenced.lastIndexOf('}');
  const jsonText = open >= 0 && close > open ? fenced.slice(open, close + 1) : fenced;
  try {
    const parsed = JSON.parse(jsonText);
    if (typeof parsed.answer === 'string') answer = parsed.answer;
    if (Array.isArray(parsed.bullets)) bullets = parsed.bullets.map((b: unknown) => String(b)).slice(0, 6);
  } catch {
    // Model returned prose instead of JSON — use the raw text as the answer.
  }
  return { model, answer, bullets };
}

/** Serialise the real computed forecast into a compact, numeric context block. */
function buildContext(
  result: ForecastResult,
  companies: ForecastResult[],
  inventory: any,
  _stats: any,
): string {
  const lines: string[] = [];
  const k = result.kpis;
  const horizon = result.weeks.length;
  lines.push(`ENTITY: ${result.companyName}`);
  lines.push(
    `KPIS: net cash flow ${signedEur(k.netCashFlow)}; min closing cash ${eur(k.minClosingCash)} ` +
      `in week of ${dateShort(k.minClosingWeek)}; weeks at risk ${k.weeksAtRisk}/${horizon}; live-weather weeks ${k.liveWeatherWeeks}/${horizon}.`,
  );
  lines.push(`WEATHER RULE: ${describeWeatherRule(result.params)}.`);
  lines.push(`WEEKLY (${horizon}-week horizon):`);
  for (const w of result.weeks) {
    lines.push(
      `  ${dateShort(w.weekStart)}: closing ${eur(w.closingCash)}, net ${signedEur(w.netCashFlow)}, ` +
        `cash-in ${eur(w.forecastCashIn)} (baseline ${eur(w.baselineCashIn)}), ` +
        `weather ${signedEur(w.weatherAdjustment)} [${w.weatherRisk} risk, ${w.weatherRiskValue} ${w.weatherRiskBasis}, ${w.weatherSource}], risk ${w.riskLevel}.`,
    );
  }
  if (companies.length > 1) {
    lines.push('PER-COMPANY EXPOSURE:');
    for (const c of companies) {
      const deferred = c.weeks.reduce((sum, w) => sum + Math.max(0, -w.weatherAdjustment), 0);
      const weatherWeeks = c.weeks.filter((w) => w.weatherRisk !== 'low').length;
      lines.push(
        `  ${c.companyName}: deferred ${eurCompact(deferred)}, weather-risk weeks ${weatherWeeks}, ` +
          `weeks at risk ${c.kpis.weeksAtRisk}, min closing ${eurCompact(c.kpis.minClosingCash)}.`,
      );
    }
  }
  const files = inventory?.files_loaded ?? inventory?.files?.length;
  const rows = inventory?.rows_loaded;
  if (files || rows) lines.push(`DATA INVENTORY: ${files ?? '?'} source files, ${rows ?? '?'} rows loaded.`);
  const missing = inventory?.missing_fields;
  if (Array.isArray(missing) && missing.length) {
    lines.push(`KNOWN ASSUMPTIONS / MISSING: ${missing.slice(0, 5).join('; ')}.`);
  }
  return lines.join('\n');
}

async function resolveForecast(
  company: string,
  scenario: Scenario,
  overrides: Partial<ForecastParams>,
): Promise<{ result: ForecastResult }> {
  if (company === 'portfolio') {
    return { result: (await computePortfolio(scenario, overrides)).portfolio };
  }
  const co = await getCompanyByCode(company);
  if (!co) throw new Error(`Unknown company ${company}`);
  return { result: await computeForecast(scenario, co.id, overrides) };
}

function covenantFloor(result: ForecastResult) {
  if (result.params.covenantFloorOverride != null) return result.params.covenantFloorOverride;
  const cov = result.covenants.find((c) => c.metric === 'min_cash_balance')
    ?? result.covenants.find((c) => c.metric === 'min_13w_liquidity');
  return cov?.threshold ?? null;
}

function describeWeatherRule(params: ForecastParams) {
  const basis = {
    rain_2mm_workdays: 'workdays with at least 2mm rain',
    heavy_5mm_workdays: 'workdays with at least 5mm rain',
    bad_workdays: 'operational bad-weather workdays',
    delay_score: 'weather delay score',
  }[params.weatherRiskMode];
  return `${basis}; medium >= ${params.weatherMediumThreshold}, high >= ${params.weatherHighThreshold}`;
}

function buildAnswer(
  rawQuestion: string,
  result: ForecastResult,
  companies: ForecastResult[],
  inventory: any,
  stats: any,
) {
  const q = rawQuestion.toLowerCase();
  const horizon = result.weeks.length;
  const deferred = result.weeks.reduce((sum, week) => sum + Math.max(0, -week.weatherAdjustment), 0);
  const netWeather = result.weeks.reduce((sum, week) => sum + week.weatherAdjustment, 0);
  const riskWeeks = result.weeks.filter((week) => week.riskLevel !== 'low');
  const floor = covenantFloor(result);
  const minHeadroom = result.weeks
    .map((week) => week.covenantHeadroom)
    .filter((headroom): headroom is number => headroom != null)
    .reduce((min, headroom) => Math.min(min, headroom), Infinity);

  if (mentions(q, ['weeks at risk', 'risk weeks', 'week at risk', 'risicoweken', 'weken met risico', 'risico weken'])) {
    const weatherHigh = result.weeks.filter((week) => week.weatherRisk === 'high').length;
    const liquidityWeeks = result.weeks.filter((week) => week.covenantHeadroom != null && week.covenantHeadroom < 0.25 * (floor ?? 0)).length;
    return {
      answer:
        `Weeks at risk is a combined CFO warning count: ${result.kpis.weeksAtRisk}/${horizon} weeks are not low-risk in the current forecast.`,
      bullets: [
        `Liquidity rule: a week is risky when closing cash is below the floor or within 25% of it${floor == null ? ' (no floor configured here).' : `; current floor is ${eur(floor)}.`}`,
        `Weather rule: ${describeWeatherRule(result.params)}; ${weatherHigh} weeks are high weather-delay weeks.`,
        `Liquidity contributes ${liquidityWeeks} tight or breached weeks; high weather can lift an otherwise calm week into the risk count.`,
      ],
      sources: ['forecast_weeks.risk_level', 'forecast_weeks.weather_risk', 'covenants', 'forecast params'],
    };
  }

  if (mentions(q, ['covenant', 'headroom', 'floor', 'warning threshold', 'vloer', 'ruimte', 'waarschuwingsvloer'])) {
    return {
      answer:
        floor == null
          ? 'There is no covenant warning floor configured for this view.'
          : `Covenant headroom is closing cash minus the warning floor. The current floor is ${eur(floor)} and minimum headroom is ${Number.isFinite(minHeadroom) ? signedEur(minHeadroom) : 'not available'}.`,
      bullets: [
        `Minimum closing cash is ${eur(result.kpis.minClosingCash)} in the week of ${dateShort(result.kpis.minClosingWeek)}.`,
        `A negative headroom week is a breach; a small positive headroom week is a warning zone.`,
        'Opening cash and covenant floors are assumptions until bank/covenant data is connected directly.',
      ],
      sources: ['forecast_weeks.closing_cash', 'forecast_weeks.covenant_headroom', 'covenants'],
    };
  }

  if (mentions(q, ['methodology', 'calculate', 'calculation', 'how are we calculating', 'defend', 'challenged', 'kritische', 'berekening', 'uitleg'])) {
    return {
      answer:
        'The defensible story is: forecast billing from history, shift timing for weather-delay risk, collect cash on debtor-payment lags, subtract modelled cash-out drivers, then compare closing cash with the warning floor.',
      bullets: [
        `Horizon: ${horizon} weeks from ${dateShort(result.weeks[0].weekStart)}.`,
        `Weather rule: ${describeWeatherRule(result.params)}. Weather shifts timing; it does not remove revenue.`,
        `Cash-out is modelled from driver assumptions, so this is the main point to disclose until AP/bank data is connected.`,
        `Net weather timing impact in this view is ${signedEur(netWeather)}.`,
      ],
      sources: ['forecast engine', 'weather_weekly', 'payment lag assumptions', 'cash-out driver assumptions'],
    };
  }

  if (mentions(q, ['scenario', 'wet', 'dry', 'sensitivity', 'forecast'])) {
    return {
      answer:
        'The live forecast is the operating answer. The CFO flow no longer asks users to choose wet/base/dry.',
      bullets: [
        `${result.kpis.liveWeatherWeeks}/${horizon} weeks use live Open-Meteo weather; the remaining weeks use seasonal climatology.`,
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
        `${dateShort(week.weekStart)}: ${week.weatherRisk} weather risk, ${week.weatherRiskValue} ${week.weatherRiskBasis}, weather cash timing ${signedEur(week.weatherAdjustment)} (${week.weatherSource}).`,
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
        `Weather timing effect: ${signedEur(week.weatherAdjustment)} with ${week.weatherRiskValue} ${week.weatherRiskBasis} and ${week.weatherRisk} weather risk.`,
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
        `Weather lag stats remain suggestive, not causal. Headline Ummels lag-5 p-value: ${stats?.companies?.ummels?.wet_dry?.find?.((r: any) => r.lag === 5)?.p_value ?? 'see stats page'}.`,
      ],
      sources: ['data_inventory.json', 'stats.json', 'source_files', 'assumptions'],
    };
  }

  const worstWeek = result.weeks.reduce((min, week) => (week.closingCash < min.closingCash ? week : min), result.weeks[0]);
  return {
    answer: `${result.companyName} forecast summary: net cash ${signedEur(result.kpis.netCashFlow)}, minimum closing cash ${eur(result.kpis.minClosingCash)} in the week of ${dateShort(result.kpis.minClosingWeek)}.`,
    bullets: [
      `${riskWeeks.length}/${horizon} weeks have medium or high risk.`,
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
