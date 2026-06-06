import type { ForecastResult, RiskLevel, RiskSignal } from '../types';

export interface RiskContext {
  isPortfolio: boolean;
  threshold: number | null; // covenant floor (€)
  driverTotalPct: number; // sum of cash-out driver shares (assumption)
  paymentStressCashIn: number | null; // horizon cash-in if debtor days +2 weeks
  reconWorstVariancePct: number | null; // worst |weekly vs monthly-summary| variance
  thinHistory: boolean; // any company with < 26 weeks of history
  underperformers: { name: string; pct: number; eur: number }[]; // recent run-rate below prior
}

const worse = (a: RiskLevel, b: RiskLevel): RiskLevel => {
  const r = ['low', 'medium', 'high'];
  return r.indexOf(a) >= r.indexOf(b) ? a : b;
};
const eur = (x: number) => `€${Math.round(x).toLocaleString('en-US')}`;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

// Suggestive lag profile from the historical analysis (NOT causal proof).
export const LAG_PROFILE =
  'Rain workdays t→t+3 ≈ −12pp, t+4 ≈ +16pp catch-up, t+5 ≈ −7pp, t+6 ≈ −10pp; ' +
  'rainfall total t+1 ≈ −15pp, t+3 ≈ −18pp, t+4 ≈ +9pp, t+5/6 ≈ −16pp. Suggestive signal, not causal (p≈0.07–0.19).';

/** Compute the eight risk signals for a forecast result + context. */
export function computeRiskSignals(result: ForecastResult, ctx: RiskContext): RiskSignal[] {
  const weeks = result.weeks;
  const k = result.kpis;
  const horizon = Math.max(1, weeks.length);
  const meanConf = Math.round(weeks.reduce((s, w) => s + w.confidence, 0) / Math.max(1, weeks.length));

  // 1) Weather Billing Risk
  const wxWeeks = weeks.filter((w) => w.weatherRisk !== 'low');
  const wxImpact = wxWeeks.reduce((s, w) => s + Math.abs(w.weatherAdjustment), 0);
  const wxHigh = weeks.filter((w) => w.weatherRisk === 'high');
  const weatherBilling: RiskSignal = {
    key: 'weather_billing',
    title: 'Weather Billing Risk',
    level: wxHigh.length ? 'high' : wxWeeks.length ? 'medium' : 'low',
    impactedWeeks: wxWeeks.map((w) => w.weekStart),
    eurImpact: Math.round(wxImpact),
    confidence: weeks.some((w) => w.weatherRisk !== 'low' && w.isLiveWeather) ? 70 : 55,
    reason:
      `${wxWeeks.length} of ${horizon} weeks carry weather-delay risk (${wxHigh.length} high). ` +
      `≈ ${eur(wxImpact)} of billing is shifted later in those weeks.`,
    trace: `weather_weekly (${result.params.weatherRiskMode}) → billing timing shift. ${LAG_PROFILE}`,
  };

  // 2) Cash-In Delay Risk (billing collected later than it is billed)
  const earlyDeferred = weeks
    .slice(0, 4)
    .reduce((s, w) => s + Math.max(0, -w.paymentLagAdjustment), 0);
  const cashInDelay: RiskSignal = {
    key: 'cash_in_delay',
    title: 'Cash-In Delay Risk',
    level: earlyDeferred > 0.4 * (k.totalCashIn / horizon) * 4 ? 'medium' : 'low',
    impactedWeeks: weeks.slice(0, 4).map((w) => w.weekStart),
    eurImpact: Math.round(earlyDeferred),
    confidence: 65,
    reason:
      `Cash-in lags billing by ~4 weeks (debtor terms): ≈ ${eur(earlyDeferred)} billed in weeks 1–4 ` +
      `collects later in the horizon.`,
    trace: 'Assumption: debtor-payment profile, mean ≈ 4 weeks (configurable).',
  };

  // 3) Payment Terms Risk — sensitivity (magnitude) of in-horizon cash-in to a
  // ~2-week change in debtor days. Reported as magnitude: the carry-in of
  // pre-horizon billing makes the *direction* ambiguous, so we surface exposure,
  // not a directional claim.
  const termsMag = ctx.paymentStressCashIn == null ? null : Math.abs(k.totalCashIn - ctx.paymentStressCashIn);
  const termsLevel: RiskLevel =
    termsMag == null ? 'medium' : termsMag > 0.07 * k.totalCashIn ? 'high' : termsMag > 0.03 * k.totalCashIn ? 'medium' : 'low';
  const paymentTerms: RiskSignal = {
    key: 'payment_terms',
    title: 'Payment Terms Risk',
    level: termsLevel,
    impactedWeeks: [],
    eurImpact: termsMag == null ? null : Math.round(termsMag),
    confidence: 55,
    reason:
      termsMag == null
        ? 'Debtor-days assumption drives cash-in timing; sensitivity not computed.'
        : `A ~2-week change in debtor days moves in-horizon cash-in by ≈ ${eur(termsMag)} (timing sensitivity).`,
    trace: 'Assumption sensitivity: payment-lag profile shifted ±2 weeks.',
  };

  // 4) Cash-Out Assumption Risk (no AP/cost ledger in the source data)
  const cashOutAssumption: RiskSignal = {
    key: 'cash_out_assumption',
    title: 'Cash-Out Assumption Risk',
    level: 'high',
    impactedWeeks: weeks.map((w) => w.weekStart),
    eurImpact: Math.round(k.totalCashOut),
    confidence: 45,
    reason:
      `All cash-out (${eur(k.totalCashOut)} over ${horizon} wks) is modelled from driver % assumptions ` +
      `(${pct(ctx.driverTotalPct)} of production) — the source data has no AP / cost ledger.`,
    trace: 'Assumptions: materials/subcontractor/labour/overhead shares. Replace with real AP to remove this risk.',
  };

  // 5) Covenant Headroom Risk
  const headrooms = weeks.map((w) => w.covenantHeadroom).filter((h): h is number => h != null);
  const minHeadroom = headrooms.length ? Math.min(...headrooms) : null;
  const floor = ctx.threshold ?? 0;
  const tight = ctx.threshold != null ? weeks.filter((w) => (w.covenantHeadroom ?? Infinity) < 0.25 * floor) : [];
  const covenant: RiskSignal = {
    key: 'covenant_headroom',
    title: 'Covenant Headroom Risk',
    level: k.covenantBreach ? 'high' : tight.length ? 'medium' : 'low',
    impactedWeeks: tight.map((w) => w.weekStart),
    eurImpact: minHeadroom,
    confidence: 60,
    reason:
      ctx.threshold == null
        ? 'No covenant floor configured for this view.'
        : k.covenantBreach
          ? `Closing cash breaches the ${eur(floor)} floor in the horizon.`
          : `Minimum headroom ${eur(minHeadroom ?? 0)} vs ${eur(floor)} floor` +
            (tight.length ? ` — tight (< 25%) in ${tight.length} weeks.` : '.'),
    trace: 'Assumption: covenant floor + opening cash (no bank balances in source data).',
  };

  // 6) Data Quality Risk
  const v = ctx.reconWorstVariancePct;
  const dqLevel: RiskLevel = v == null ? 'medium' : Math.abs(v) > 0.2 ? 'high' : Math.abs(v) > 0.05 ? 'medium' : 'low';
  const dataQuality: RiskSignal = {
    key: 'data_quality',
    title: 'Data Quality Risk',
    level: worse(dqLevel, 'medium'), // billing-only source is at least medium
    impactedWeeks: [],
    eurImpact: null,
    confidence: 60,
    reason:
      'Source is billing/revenue only (no bank cashflow). ' +
      (v == null
        ? 'Only Opco A has a monthly summary to reconcile against.'
        : `Worst weekly-vs-monthly reconciliation variance ≈ ${pct(Math.abs(v))} (partial account coverage).`),
    trace: 'data_inventory reconciliation + missing-fields list (Data Quality view).',
  };

  // 7) Forecast Confidence Risk
  const confLevel: RiskLevel = meanConf < 60 ? 'high' : meanConf < 72 ? 'medium' : 'low';
  const liveWeeks = weeks.filter((w) => w.isLiveWeather).length;
  const forecastConfidence: RiskSignal = {
    key: 'forecast_confidence',
    title: 'Forecast Confidence Risk',
    level: worse(confLevel, ctx.thinHistory ? 'medium' : 'low'),
    impactedWeeks: weeks.filter((w) => w.confidence < 65).map((w) => w.weekStart),
    eurImpact: null,
    confidence: meanConf,
    reason:
      `Mean weekly confidence ${meanConf}%. Weeks 1–${liveWeeks} use live Open-Meteo (higher); ` +
      `weeks ${liveWeeks + 1}–${horizon} use seasonal climatology (lower)` +
      (ctx.thinHistory ? '; a company has thin history (< 26 wks).' : '.'),
    trace: 'Live-vs-seasonal weather split + history depth.',
  };

  // 8) Opco Underperformance Risk
  const under = ctx.underperformers;
  const worst = under.reduce((m, u) => (u.pct < m ? u.pct : m), 0);
  const opcoUnder: RiskSignal = {
    key: 'opco_underperformance',
    title: 'Opco Underperformance Risk',
    level: worst < -0.15 ? 'high' : worst < -0.08 ? 'medium' : 'low',
    impactedWeeks: [],
    eurImpact: under.length ? Math.round(under.reduce((s, u) => s + u.eur, 0)) : null,
    confidence: 65,
    reason: under.length
      ? `${under.map((u) => `${u.name} ${pct(u.pct)}`).join(', ')} running below recent run-rate.`
      : 'Recent run-rate in line with prior periods.',
    trace: 'Last-8-week actual facturation vs the prior 18 weeks (weekly_financials).',
  };

  return [
    weatherBilling, cashInDelay, paymentTerms, cashOutAssumption,
    covenant, dataQuality, forecastConfidence, opcoUnder,
  ];
}
