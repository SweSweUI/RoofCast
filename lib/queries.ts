import { query, queryOne } from './db';
import type {
  AssumptionRow,
  Company,
  Covenant,
  TransactionRow,
  WeatherWeek,
  WeeklyFinancial,
} from './types';
import fs from 'node:fs';
import path from 'node:path';

// --- companies --------------------------------------------------------------
export function getCompanies(): Company[] {
  return query<any>(
    `SELECT id, code, name, short_name, location_name, latitude, longitude,
            weather_location_id, source_system, source_confidence, is_assumption, notes
     FROM companies ORDER BY id`,
  ).map(mapCompany);
}

export function getCompany(id: number): Company | undefined {
  const r = queryOne<any>(
    `SELECT id, code, name, short_name, location_name, latitude, longitude,
            weather_location_id, source_system, source_confidence, is_assumption, notes
     FROM companies WHERE id = ?`,
    id,
  );
  return r ? mapCompany(r) : undefined;
}

export function getCompanyByCode(code: string): Company | undefined {
  const r = queryOne<any>('SELECT id FROM companies WHERE code = ?', code);
  return r ? getCompany(r.id) : undefined;
}

function mapCompany(r: any): Company {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    shortName: r.short_name,
    locationName: r.location_name,
    latitude: r.latitude,
    longitude: r.longitude,
    weatherLocationId: r.weather_location_id,
    sourceSystem: r.source_system,
    sourceConfidence: r.source_confidence,
    isAssumption: r.is_assumption,
    notes: r.notes,
  };
}

// --- weekly financials ------------------------------------------------------
export function getWeeklyFinancials(companyId: number): WeeklyFinancial[] {
  return query<any>(
    `SELECT week_start, revenue_net, credit_total, debit_total, transaction_count
     FROM weekly_financials WHERE company_id = ? ORDER BY week_start`,
    companyId,
  ).map((r) => ({
    weekStart: r.week_start,
    revenueNet: r.revenue_net,
    creditTotal: r.credit_total,
    debitTotal: r.debit_total,
    txnCount: r.transaction_count,
  }));
}

// --- weather ----------------------------------------------------------------
export function getWeatherWeekly(locationId: number): WeatherWeek[] {
  return query<any>(
    `SELECT week_start, rain_sum, workday_rain_sum, rain_days_2mm, rain_days_5mm,
            bad_workdays, delay_score, is_forecast, source
     FROM weather_weekly WHERE location_id = ? ORDER BY week_start`,
    locationId,
  ).map((r) => ({
    weekStart: r.week_start,
    rainSum: r.rain_sum,
    workdayRainSum: r.workday_rain_sum,
    rainDays2mm: r.rain_days_2mm,
    rainDays5mm: r.rain_days_5mm,
    badWorkdays: r.bad_workdays,
    delayScore: r.delay_score,
    isForecast: r.is_forecast,
    source: r.source,
  }));
}

export function getWeatherLocations() {
  return query<any>(
    'SELECT id, code, name, latitude, longitude, notes FROM weather_locations ORDER BY id',
  );
}

// --- covenants + assumptions ------------------------------------------------
export function getCovenants(companyId: number | null): Covenant[] {
  const rows =
    companyId == null
      ? query<any>('SELECT * FROM covenants ORDER BY id')
      : query<any>(
          'SELECT * FROM covenants WHERE company_id = ? OR company_id IS NULL ORDER BY id',
          companyId,
        );
  return rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    metric: r.metric,
    threshold: r.threshold,
    direction: r.direction,
    unit: r.unit,
    basis: r.basis,
    isAssumption: r.is_assumption,
  }));
}

export function getAssumptions(): AssumptionRow[] {
  return query<any>(
    `SELECT id, key, scope, category, value_num, value_text, unit, rationale, source
     FROM assumptions ORDER BY category, key`,
  ).map((r) => ({
    id: r.id,
    key: r.key,
    scope: r.scope,
    category: r.category,
    valueNum: r.value_num,
    valueText: r.value_text,
    unit: r.unit,
    rationale: r.rationale,
    source: r.source,
  }));
}

// --- traceability -----------------------------------------------------------
export function getTransactionsForWeek(
  companyId: number,
  weekStart: string,
  limit = 25,
): TransactionRow[] {
  return query<any>(
    `SELECT id, date, week_start, document_number, journal, account_code,
            debit, credit, amount_net, description
     FROM transactions
     WHERE company_id = ? AND week_start = ?
     ORDER BY ABS(amount_net) DESC LIMIT ?`,
    companyId,
    weekStart,
    limit,
  ).map((r) => ({
    id: r.id,
    date: r.date,
    weekStart: r.week_start,
    documentNumber: r.document_number,
    journal: r.journal,
    accountCode: r.account_code,
    debit: r.debit,
    credit: r.credit,
    amountNet: r.amount_net,
    description: r.description,
  }));
}

/** Sample real source transactions from the historical analog weeks that inform
 *  a forecast week's baseline (same ISO week in prior years + most recent weeks). */
export function getAnalogTransactions(
  companyId: number,
  analogWeeks: string[],
  limit = 12,
): TransactionRow[] {
  if (analogWeeks.length === 0) return [];
  const placeholders = analogWeeks.map(() => '?').join(',');
  return query<any>(
    `SELECT id, date, week_start, document_number, journal, account_code,
            debit, credit, amount_net, description
     FROM transactions
     WHERE company_id = ? AND week_start IN (${placeholders}) AND credit > 0
     ORDER BY credit DESC LIMIT ?`,
    companyId,
    ...analogWeeks,
    limit,
  ).map((r) => ({
    id: r.id,
    date: r.date,
    weekStart: r.week_start,
    documentNumber: r.document_number,
    journal: r.journal,
    accountCode: r.account_code,
    debit: r.debit,
    credit: r.credit,
    amountNet: r.amount_net,
    description: r.description,
  }));
}

// --- data quality / inventory ----------------------------------------------
export function getInventory(): any {
  const file = path.resolve(process.cwd(), 'data/artifacts/data_inventory.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  return null;
}

export function getStatsArtifact(name: string): any {
  const file = path.resolve(process.cwd(), `data/artifacts/${name}`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  return null;
}

export function getSourceFiles() {
  return query<any>(
    `SELECT filename, source_group, sheet_name, file_type, row_count,
            detected_company, detected_system, notes
     FROM source_files ORDER BY source_group, filename`,
  );
}

export function getAccountsSummary() {
  return query<any>(
    `SELECT c.short_name AS company, a.source_account_code AS code,
            a.source_account_name AS name, a.normalized_category AS category,
            a.mapping_confidence AS confidence, a.mapping_method AS method,
            COUNT(t.id) AS txns
     FROM accounts a
     JOIN companies c ON c.id = a.company_id
     LEFT JOIN transactions t ON t.account_id = a.id
     GROUP BY a.id ORDER BY c.short_name, a.source_account_code`,
  );
}
