import type { ForecastParams, Scenario } from '../types';

/**
 * Canonical default forecast parameters. The Python pipeline mirrors the
 * headline values into the `assumptions` table for display; this file is the
 * single source of truth the live engine uses. The API merges user overrides
 * on top of these.
 *
 * All figures are configurable assumptions — see docs/forecast_model.md. The
 * weather relationship is treated as a *risk signal*, not a causal law.
 */
export const DEFAULT_PARAMS: Omit<ForecastParams, 'startWeek' | 'openingCash'> = {
  horizonWeeks: 13,

  // Cash-out drivers as a share of weekly production (no outflow GL in the data).
  drivers: { materials: 0.32, subcontractor: 0.18, labour: 0.22, overhead: 0.1 },
  // Supplier/payroll payment lag per driver (weeks).
  driverLagWeeks: { materials: 2, subcontractor: 3, labour: 0, overhead: 0 },

  // Debtor collection profile: weight by weeks after billing (index = lag).
  // Mean ≈ 4 weeks (~30 working days). Sums to 1.0.
  paymentLagWeights: [0, 0, 0.1, 0.2, 0.3, 0.2, 0.12, 0.05, 0.03],

  // Weather-delay timing shift: share of a week's billing pushed later.
  weatherShiftHigh: 0.25, // 3+ rain workdays
  weatherShiftMedium: 0.12, // 2 rain workdays
  // Shifted work reappears (catch-up) starting +4 weeks, spread over +4..+7.
  catchUpStartLag: 4,
  catchUpWeights: [0.3, 0.25, 0.25, 0.2],

  baselineLookbackWeeks: 8,
  weatherIntensity: 1.0,
};

/** Internal stress-test weather intensity. The operating dashboard always uses
 *  the live forecast basis; these variants are retained for audit/model tests. */
export const SCENARIO_WEATHER_INTENSITY: Record<Scenario, number> = {
  base: 1.0,
  wet_quarter: 1.5,
  dry_quarter: 0.5,
};

/** Opening cash per company at the forecast start. Assumption — the revenue-only
 *  exports contain no bank balances. Mirrors pipeline/config.py OPENING_CASH. */
export const OPENING_CASH: Record<string, number> = {
  ummels: 600000,
  'opco-a': 900000,
  // Opco C is deliberately set to a tight liquidity position (assumption) so it
  // reads as the portfolio's covenant-risk concentration (thin headroom vs floor).
  'opco-gilde': 200000,
  'opco-e': 120000,
};
export const DEFAULT_OPENING_CASH = 300000;

export const SCENARIO_NOTE: Record<Scenario, string> = {
  base: 'Operating forecast: live Open-Meteo near term, then ISO-week seasonal climatology.',
  wet_quarter: 'Sensitivity only: ~50% more rain workdays than seasonal normal after the live forecast window.',
  dry_quarter: 'Sensitivity only: ~50% fewer rain workdays than seasonal normal after the live forecast window.',
};

export function resolveParams(
  scenario: Scenario,
  base: { startWeek: string; openingCash: number },
  overrides: Partial<ForecastParams> = {},
): ForecastParams {
  return {
    ...DEFAULT_PARAMS,
    startWeek: base.startWeek,
    openingCash: base.openingCash,
    weatherIntensity: SCENARIO_WEATHER_INTENSITY[scenario],
    ...overrides,
    // nested objects need explicit merge if partially overridden
    drivers: { ...DEFAULT_PARAMS.drivers, ...(overrides.drivers ?? {}) },
    driverLagWeeks: { ...DEFAULT_PARAMS.driverLagWeeks, ...(overrides.driverLagWeeks ?? {}) },
  };
}
