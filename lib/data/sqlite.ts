// SQLite implementation of the data layer (local-first fallback).
// All functions are async to match the Supabase implementation's signature.
import { query, queryOne } from '../db';
import type {
  AssumptionRow,
  Company,
  Covenant,
  TransactionRow,
  WeatherWeek,
  WeeklyFinancial,
} from '../types';
import fs from 'node:fs';
import path from 'node:path';

function mapCompany(r: any): Company {
  return {
    id: r.id, code: r.code, name: r.name, shortName: r.short_name,
    locationName: r.location_name, latitude: r.latitude, longitude: r.longitude,
    weatherLocationId: r.weather_location_id, sourceSystem: r.source_system,
    sourceConfidence: r.source_confidence, isAssumption: r.is_assumption, notes: r.notes,
  };
}

export async function getCompanies(): Promise<Company[]> {
  return query<any>(
    `SELECT id, code, name, short_name, location_name, latitude, longitude,
            weather_location_id, source_system, source_confidence, is_assumption, notes
     FROM companies ORDER BY id`,
  ).map(mapCompany);
}

export async function getCompany(id: number): Promise<Company | undefined> {
  const r = queryOne<any>(
    `SELECT id, code, name, short_name, location_name, latitude, longitude,
            weather_location_id, source_system, source_confidence, is_assumption, notes
     FROM companies WHERE id = ?`, id);
  return r ? mapCompany(r) : undefined;
}

export async function getCompanyByCode(code: string): Promise<Company | undefined> {
  const r = queryOne<any>('SELECT id FROM companies WHERE code = ?', code);
  return r ? getCompany(r.id) : undefined;
}

export async function getCompaniesWithFinancials(): Promise<Company[]> {
  const all = await getCompanies();
  return all.filter((c) => {
    const n = queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM weekly_financials WHERE company_id = ?', c.id);
    return (n?.n ?? 0) > 0;
  });
}

export async function getEarliestForecastWeatherWeek(): Promise<string | null> {
  const r = queryOne<{ w: string }>(
    "SELECT MIN(week_start) AS w FROM weather_weekly WHERE is_forecast = 1");
  return r?.w ?? null;
}

export async function getWeeklyFinancials(companyId: number): Promise<WeeklyFinancial[]> {
  return query<any>(
    `SELECT week_start, revenue_net, credit_total, debit_total, transaction_count
     FROM weekly_financials WHERE company_id = ? ORDER BY week_start`, companyId,
  ).map((r) => ({
    weekStart: r.week_start, revenueNet: r.revenue_net, creditTotal: r.credit_total,
    debitTotal: r.debit_total, txnCount: r.transaction_count,
  }));
}

export async function getWeatherWeekly(locationId: number): Promise<WeatherWeek[]> {
  return query<any>(
    `SELECT week_start, rain_sum, workday_rain_sum, rain_days_2mm, rain_days_5mm,
            bad_workdays, delay_score, is_forecast, source
     FROM weather_weekly WHERE location_id = ? ORDER BY week_start`, locationId,
  ).map((r) => ({
    weekStart: r.week_start, rainSum: r.rain_sum, workdayRainSum: r.workday_rain_sum,
    rainDays2mm: r.rain_days_2mm, rainDays5mm: r.rain_days_5mm, badWorkdays: r.bad_workdays,
    delayScore: r.delay_score, isForecast: r.is_forecast, source: r.source,
  }));
}

export async function getWeatherLocations(): Promise<any[]> {
  return query<any>('SELECT id, code, name, latitude, longitude, notes FROM weather_locations ORDER BY id');
}

export async function getCovenants(companyId: number | null): Promise<Covenant[]> {
  const rows = companyId == null
    ? query<any>('SELECT * FROM covenants ORDER BY id')
    : query<any>('SELECT * FROM covenants WHERE company_id = ? OR company_id IS NULL ORDER BY id', companyId);
  return rows.map((r) => ({
    id: r.id, companyId: r.company_id, name: r.name, metric: r.metric, threshold: r.threshold,
    direction: r.direction, unit: r.unit, basis: r.basis, isAssumption: r.is_assumption,
  }));
}

export async function getAssumptions(): Promise<AssumptionRow[]> {
  return query<any>(
    `SELECT id, key, scope, category, value_num, value_text, unit, rationale, source
     FROM assumptions ORDER BY category, key`,
  ).map((r) => ({
    id: r.id, key: r.key, scope: r.scope, category: r.category, valueNum: r.value_num,
    valueText: r.value_text, unit: r.unit, rationale: r.rationale, source: r.source,
  }));
}

const mapTx = (r: any): TransactionRow => ({
  id: r.id, date: r.date, weekStart: r.week_start, documentNumber: r.document_number,
  journal: r.journal, accountCode: r.account_code, debit: r.debit, credit: r.credit,
  amountNet: r.amount_net, description: r.description,
});

export async function getTransactionsForWeek(companyId: number, weekStart: string, limit = 25): Promise<TransactionRow[]> {
  return query<any>(
    `SELECT id, date, week_start, document_number, journal, account_code, debit, credit,
            amount_net, description FROM transactions
     WHERE company_id = ? AND week_start = ? ORDER BY ABS(amount_net) DESC LIMIT ?`,
    companyId, weekStart, limit,
  ).map(mapTx);
}

export async function getAnalogTransactions(companyId: number, analogWeeks: string[], limit = 12): Promise<TransactionRow[]> {
  if (analogWeeks.length === 0) return [];
  const placeholders = analogWeeks.map(() => '?').join(',');
  return query<any>(
    `SELECT id, date, week_start, document_number, journal, account_code, debit, credit,
            amount_net, description FROM transactions
     WHERE company_id = ? AND week_start IN (${placeholders}) AND credit > 0
     ORDER BY credit DESC LIMIT ?`,
    companyId, ...analogWeeks, limit,
  ).map(mapTx);
}

export async function getSourceFiles(): Promise<any[]> {
  return query<any>(
    `SELECT filename, source_group, sheet_name, file_type, row_count,
            detected_company, detected_system, notes
     FROM source_files ORDER BY source_group, filename`);
}

export async function getAccountsSummary(): Promise<any[]> {
  return query<any>(
    `SELECT c.short_name AS company, a.source_account_code AS code,
            a.source_account_name AS name, a.normalized_category AS category,
            a.mapping_confidence AS confidence, a.mapping_method AS method, COUNT(t.id) AS txns
     FROM accounts a JOIN companies c ON c.id = a.company_id
     LEFT JOIN transactions t ON t.account_id = a.id
     GROUP BY a.id ORDER BY c.short_name, a.source_account_code`);
}

// Artifacts read from disk (derived build reports, identical in both backends).
function readArtifact(name: string): any {
  const file = path.resolve(process.cwd(), `data/artifacts/${name}`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null;
}
export async function getInventory(): Promise<any> {
  return readArtifact('data_inventory.json');
}
export async function getStatsArtifact(name: string): Promise<any> {
  return readArtifact(name);
}
