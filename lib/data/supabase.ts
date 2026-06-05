// Supabase (Postgres/PostgREST) implementation of the data layer.
// Uses the service-role client server-side. Reads the altis_* tables.
import { supabaseAdmin } from '../supabase/admin';
import type {
  AssumptionRow, Company, Covenant, TransactionRow, WeatherWeek, WeeklyFinancial,
} from '../types';
import fs from 'node:fs';
import path from 'node:path';

const num = (v: any): number => (v == null ? 0 : typeof v === 'number' ? v : Number(v));
const numN = (v: any): number | null => (v == null ? null : Number(v));

function mapCompany(r: any): Company {
  return {
    id: r.id, code: r.code, name: r.name, shortName: r.short_name,
    locationName: r.location_name, latitude: numN(r.latitude), longitude: numN(r.longitude),
    weatherLocationId: r.weather_location_id, sourceSystem: r.source_system,
    sourceConfidence: r.source_confidence, isAssumption: r.is_assumption, notes: r.notes,
  };
}

async function rows<T = any>(q: any): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data ?? []) as T[];
}

export async function getCompanies(): Promise<Company[]> {
  const sb = supabaseAdmin();
  return (await rows(sb.from('altis_companies').select('*').order('id'))).map(mapCompany);
}

export async function getCompany(id: number): Promise<Company | undefined> {
  const sb = supabaseAdmin();
  const r = await rows(sb.from('altis_companies').select('*').eq('id', id).limit(1));
  return r[0] ? mapCompany(r[0]) : undefined;
}

export async function getCompanyByCode(code: string): Promise<Company | undefined> {
  const sb = supabaseAdmin();
  const r = await rows(sb.from('altis_companies').select('*').eq('code', code).limit(1));
  return r[0] ? mapCompany(r[0]) : undefined;
}

export async function getCompaniesWithFinancials(): Promise<Company[]> {
  const sb = supabaseAdmin();
  const wf = await rows<{ company_id: number }>(sb.from('altis_weekly_financials').select('company_id'));
  const withData = new Set(wf.map((r) => r.company_id));
  return (await getCompanies()).filter((c) => withData.has(c.id));
}

export async function getEarliestForecastWeatherWeek(): Promise<string | null> {
  const sb = supabaseAdmin();
  const r = await rows<{ week_start: string }>(
    sb.from('altis_weather_weekly').select('week_start').eq('is_forecast', 1).order('week_start').limit(1));
  return r[0]?.week_start ?? null;
}

export async function getWeeklyFinancials(companyId: number): Promise<WeeklyFinancial[]> {
  const sb = supabaseAdmin();
  const r = await rows(sb.from('altis_weekly_financials')
    .select('week_start,revenue_net,credit_total,debit_total,transaction_count')
    .eq('company_id', companyId).order('week_start'));
  return r.map((x) => ({
    weekStart: x.week_start, revenueNet: num(x.revenue_net), creditTotal: num(x.credit_total),
    debitTotal: num(x.debit_total), txnCount: x.transaction_count,
  }));
}

export async function getWeatherWeekly(locationId: number): Promise<WeatherWeek[]> {
  const sb = supabaseAdmin();
  const r = await rows(sb.from('altis_weather_weekly')
    .select('week_start,rain_sum,workday_rain_sum,rain_days_2mm,rain_days_5mm,bad_workdays,delay_score,is_forecast,source')
    .eq('location_id', locationId).order('week_start'));
  return r.map((x) => ({
    weekStart: x.week_start, rainSum: num(x.rain_sum), workdayRainSum: num(x.workday_rain_sum),
    rainDays2mm: x.rain_days_2mm, rainDays5mm: x.rain_days_5mm, badWorkdays: x.bad_workdays,
    delayScore: num(x.delay_score), isForecast: x.is_forecast, source: x.source,
  }));
}

export async function getWeatherLocations(): Promise<any[]> {
  const sb = supabaseAdmin();
  return rows(sb.from('altis_weather_locations').select('id,code,name,latitude,longitude,notes').order('id'));
}

export async function getCovenants(companyId: number | null): Promise<Covenant[]> {
  const sb = supabaseAdmin();
  let q = sb.from('altis_covenants').select('*').order('id');
  if (companyId != null) q = q.or(`company_id.eq.${companyId},company_id.is.null`);
  const r = await rows(q);
  return r.map((x) => ({
    id: x.id, companyId: x.company_id, name: x.name, metric: x.metric, threshold: num(x.threshold),
    direction: x.direction, unit: x.unit, basis: x.basis, isAssumption: x.is_assumption,
  }));
}

export async function getAssumptions(): Promise<AssumptionRow[]> {
  const sb = supabaseAdmin();
  const r = await rows(sb.from('altis_assumptions')
    .select('id,key,scope,category,value_num,value_text,unit,rationale,source').order('category').order('key'));
  return r.map((x) => ({
    id: x.id, key: x.key, scope: x.scope, category: x.category, valueNum: numN(x.value_num),
    valueText: x.value_text, unit: x.unit, rationale: x.rationale, source: x.source,
  }));
}

const mapTx = (x: any): TransactionRow => ({
  id: x.id, date: x.date, weekStart: x.week_start, documentNumber: x.document_number,
  journal: x.journal, accountCode: x.account_code, debit: num(x.debit), credit: num(x.credit),
  amountNet: num(x.amount_net), description: x.description,
});

export async function getTransactionsForWeek(companyId: number, weekStart: string, limit = 25): Promise<TransactionRow[]> {
  const sb = supabaseAdmin();
  const r = await rows(sb.from('altis_transactions')
    .select('id,date,week_start,document_number,journal,account_code,debit,credit,amount_net,description')
    .eq('company_id', companyId).eq('week_start', weekStart).order('amount_net', { ascending: false }).limit(limit));
  return r.map(mapTx);
}

export async function getAnalogTransactions(companyId: number, analogWeeks: string[], limit = 12): Promise<TransactionRow[]> {
  if (analogWeeks.length === 0) return [];
  const sb = supabaseAdmin();
  const r = await rows(sb.from('altis_transactions')
    .select('id,date,week_start,document_number,journal,account_code,debit,credit,amount_net,description')
    .eq('company_id', companyId).in('week_start', analogWeeks).gt('credit', 0)
    .order('credit', { ascending: false }).limit(limit));
  return r.map(mapTx);
}

export async function getSourceFiles(): Promise<any[]> {
  const sb = supabaseAdmin();
  return rows(sb.from('altis_source_files')
    .select('filename,source_group,sheet_name,file_type,row_count,detected_company,detected_system,notes')
    .order('source_group').order('filename'));
}

export async function getAccountsSummary(): Promise<any[]> {
  const sb = supabaseAdmin();
  return rows(sb.from('altis_accounts_summary').select('*'));
}

function readArtifact(name: string): any {
  const file = path.resolve(process.cwd(), `data/artifacts/${name}`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null;
}

export async function getInventory(): Promise<any> {
  const sb = supabaseAdmin();
  try {
    const r = await rows<{ summary: any }>(
      sb.from('altis_pipeline_runs').select('summary').order('id', { ascending: false }).limit(1));
    if (r[0]?.summary) return r[0].summary;
  } catch {
    /* fall through to local artifact */
  }
  return readArtifact('data_inventory.json');
}

export async function getStatsArtifact(name: string): Promise<any> {
  return readArtifact(name); // derived report; read from disk
}
