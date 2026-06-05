// Shared domain types for the Altis weather-aware cashflow platform.

export type Scenario = 'base' | 'wet_quarter' | 'dry_quarter';
export const SCENARIOS: Scenario[] = ['base', 'wet_quarter', 'dry_quarter'];
export const SCENARIO_LABELS: Record<Scenario, string> = {
  base: 'Base',
  wet_quarter: 'Wet quarter',
  dry_quarter: 'Dry quarter',
};

export type RiskLevel = 'low' | 'medium' | 'high';
export type Role = 'cfo' | 'board' | 'opco' | 'project';

export interface Company {
  id: number;
  code: string;
  name: string;
  shortName: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  weatherLocationId: number | null;
  sourceSystem: string | null;
  sourceConfidence: string | null;
  isAssumption: number;
  notes: string | null;
}

export interface WeeklyFinancial {
  weekStart: string; // ISO Monday
  revenueNet: number;
  creditTotal: number; // gross facturation
  debitTotal: number;
  txnCount: number;
}

export interface WeatherWeek {
  weekStart: string;
  rainSum: number;
  workdayRainSum: number;
  rainDays2mm: number;
  rainDays5mm: number;
  badWorkdays: number;
  delayScore: number;
  isForecast: number;
  source: string;
}

export interface Covenant {
  id: number;
  companyId: number | null;
  name: string;
  metric: string;
  threshold: number;
  direction: 'min' | 'max';
  unit: string | null;
  basis: string | null;
  isAssumption: number;
}

export interface AssumptionRow {
  id: number;
  key: string;
  scope: string;
  category: string;
  valueNum: number | null;
  valueText: string | null;
  unit: string | null;
  rationale: string | null;
  source: string | null;
}

export interface TransactionRow {
  id: number;
  date: string;
  weekStart: string;
  documentNumber: string;
  journal: string;
  accountCode: string;
  debit: number;
  credit: number;
  amountNet: number;
  description: string;
}

// --- forecast engine I/O ---------------------------------------------------

export interface DriverParams {
  materials: number;
  subcontractor: number;
  labour: number;
  overhead: number;
}

export interface ForecastParams {
  horizonWeeks: number;
  startWeek: string; // ISO Monday of forecast week 1
  openingCash: number;
  drivers: DriverParams; // share of weekly production
  driverLagWeeks: DriverParams; // payment lag (weeks) per driver
  paymentLagWeights: number[]; // index = weeks after billing, sums to 1
  weatherShiftHigh: number; // share of production shifted out on a high-risk week
  weatherShiftMedium: number; // share on a medium-risk week
  catchUpStartLag: number; // first lag (weeks) the shifted work reappears
  catchUpWeights: number[]; // distribution of shifted work into later weeks
  baselineLookbackWeeks: number; // trailing weeks for level
  // scenario weather intensity multiplier on expected rain workdays / delay score
  weatherIntensity: number;
}

export interface DriverContribution {
  materials: number;
  subcontractor: number;
  labour: number;
  overhead: number;
}

export interface ForecastWeek {
  weekIndex: number; // 1..horizon
  weekStart: string;
  isLiveWeather: boolean;
  weatherSource: string;
  expectedRainWorkdays: number;
  weatherRisk: RiskLevel;
  delayScore: number;
  baselineProduction: number;
  adjustedProduction: number;
  baselineCashIn: number;
  forecastCashIn: number;
  forecastCashOut: number;
  drivers: DriverContribution;
  weatherAdjustment: number; // signed € (cash-in delta vs baseline)
  paymentLagAdjustment: number;
  netCashFlow: number;
  closingCash: number;
  covenantHeadroom: number | null;
  riskLevel: RiskLevel;
  confidence: number; // 0-100 forecast confidence for this week
  explanation: string;
}

export interface RiskSignal {
  key: string;
  title: string;
  level: RiskLevel;
  impactedWeeks: string[]; // week starts
  eurImpact: number | null;
  confidence: number; // 0-100
  reason: string; // plain English
  trace: string; // data / assumption lineage
}

export interface TraceLink {
  driver: string;
  contributionAmount: number;
  adjustmentReason: string;
}

export interface ForecastKpis {
  totalCashIn: number;
  totalCashOut: number;
  netCashFlow: number;
  minClosingCash: number;
  minClosingWeek: string;
  endingCash: number;
  weeksAtRisk: number;
  covenantBreach: boolean;
  liveWeatherWeeks: number;
}

export interface ForecastResult {
  scenario: Scenario;
  companyId: number;
  companyName: string;
  weeks: ForecastWeek[];
  trace: Record<string, TraceLink[]>;
  kpis: ForecastKpis;
  covenants: Covenant[];
  params: ForecastParams;
}
