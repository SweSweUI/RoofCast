// Shared domain types for the Altis weather-aware cashflow platform.

export type Scenario = 'base' | 'wet_quarter' | 'dry_quarter';
export const SCENARIOS: Scenario[] = ['base', 'wet_quarter', 'dry_quarter'];
export const SCENARIO_LABELS: Record<Scenario, string> = {
  base: 'Live forecast',
  wet_quarter: 'Wet sensitivity',
  dry_quarter: 'Dry sensitivity',
};

export type RiskLevel = 'low' | 'medium' | 'high';
export type Role = 'cfo' | 'board' | 'opco' | 'project';
export type WeatherRiskMode = 'rain_2mm_workdays' | 'heavy_5mm_workdays' | 'bad_workdays' | 'delay_score';

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
  weatherRiskMode: WeatherRiskMode; // which weather field drives low/medium/high risk
  weatherMediumThreshold: number; // medium risk threshold for the selected weatherRiskMode
  weatherHighThreshold: number; // high risk threshold for the selected weatherRiskMode
  catchUpStartLag: number; // first lag (weeks) the shifted work reappears
  catchUpWeights: number[]; // distribution of shifted work into later weeks
  baselineLookbackWeeks: number; // trailing weeks for level
  // scenario weather intensity multiplier on expected rain workdays / delay score
  weatherIntensity: number;
  covenantFloorOverride?: number; // optional dashboard override for the covenant warning floor
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
  weatherRiskBasis: string;
  weatherRiskValue: number;
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

export interface WeatherApi167Current {
  time: string | null;
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirectionText: string | null;
  pressure: number | null;
  visibility: number | null;
  precipitation: number | null;
  cloudCover: number | null;
  uvIndex: number | null;
  condition: string | null;
}

export interface WeatherApi167Hourly {
  time: string;
  temperature: number | null;
  condition: string | null;
  precipitationProbability: number | null;
}

export interface WeatherApi167Daily {
  date: string;
  condition: string | null;
  tempMax: number | null;
  tempMin: number | null;
  precipitation: number | null;
  uvIndex: number | null;
}

export interface WeatherApi167AirQuality {
  time: string | null;
  usAqi: number | null;
  category: string | null;
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
}

export interface WeatherApi167Detail {
  provider: 'rapidapi-weather-api167' | 'weather-api-site-direct';
  providerLabel: string;
  rapidApiConfigured: boolean;
  fetchedAt: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  current: WeatherApi167Current | null;
  hourly: WeatherApi167Hourly[];
  daily: WeatherApi167Daily[];
  airQuality: WeatherApi167AirQuality | null;
  error?: string;
}

export interface MapCompanyMarker {
  id: number;
  code: string;
  name: string;
  shortName: string;
  sourceSystem: string | null;
  sourceConfidence: string | null;
  locationName: string | null;
  latitude: number;
  longitude: number;
  weatherLocationId: number | null;
  isAssumption: boolean;
  locationNote: string | null;
  riskLevel: RiskLevel;
  weatherRisk: RiskLevel;
  cashRisk: RiskLevel;
  currentWeekRisk: RiskLevel;
  currentWeekRainWorkdays: number;
  liveWeatherWeeks: number;
  mediumRiskWeeks: number;
  highRiskWeeks: number;
  nextRiskWeek: string | null;
  weatherSource: string;
  estimatedWeatherCashImpact: number;
  deferredCashImpact: number;
  worstWeeklyWeatherImpact: number;
  minClosingCash: number;
  weeksAtRisk: number;
}

export interface MapResponse {
  scenario: Scenario;
  startWeek: string | null;
  generatedAt: string;
  markers: MapCompanyMarker[];
  portfolio: {
    riskLevel: RiskLevel;
    companies: number;
    companiesWithProxyLocations: number;
    highRiskMarkers: number;
    mediumRiskMarkers: number;
    estimatedWeatherCashImpact: number;
    deferredCashImpact: number;
  };
}
