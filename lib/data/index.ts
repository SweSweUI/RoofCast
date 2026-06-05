// Data-layer dispatcher. Picks Supabase (default when configured) or the local
// SQLite fallback. Uses a LAZY dynamic import so the unused backend's module —
// and its dependencies (e.g. node:sqlite) — is never loaded. This keeps the
// Supabase deployment free of the node:sqlite requirement.
import { supabaseConfigured } from '../supabase/admin';
import type {
  AssumptionRow, Company, Covenant, TransactionRow, WeatherWeek, WeeklyFinancial,
} from '../types';

type Impl = typeof import('./sqlite');

let implPromise: Promise<Impl> | null = null;

export function activeBackend(): 'supabase' | 'sqlite' {
  const b = process.env.DATA_BACKEND;
  if (b === 'sqlite') return 'sqlite';
  if (b === 'supabase') return 'supabase';
  return supabaseConfigured() ? 'supabase' : 'sqlite';
}

function impl(): Promise<Impl> {
  if (!implPromise) {
    implPromise = activeBackend() === 'supabase'
      ? (import('./supabase') as Promise<Impl>)
      : (import('./sqlite') as Promise<Impl>);
  }
  return implPromise;
}

export const getCompanies = async (): Promise<Company[]> => (await impl()).getCompanies();
export const getCompany = async (id: number): Promise<Company | undefined> => (await impl()).getCompany(id);
export const getCompanyByCode = async (code: string): Promise<Company | undefined> => (await impl()).getCompanyByCode(code);
export const getCompaniesWithFinancials = async (): Promise<Company[]> => (await impl()).getCompaniesWithFinancials();
export const getEarliestForecastWeatherWeek = async (): Promise<string | null> => (await impl()).getEarliestForecastWeatherWeek();
export const getWeeklyFinancials = async (id: number): Promise<WeeklyFinancial[]> => (await impl()).getWeeklyFinancials(id);
export const getWeatherWeekly = async (id: number): Promise<WeatherWeek[]> => (await impl()).getWeatherWeekly(id);
export const getWeatherLocations = async (): Promise<any[]> => (await impl()).getWeatherLocations();
export const getCovenants = async (id: number | null): Promise<Covenant[]> => (await impl()).getCovenants(id);
export const getAssumptions = async (): Promise<AssumptionRow[]> => (await impl()).getAssumptions();
export const getTransactionsForWeek = async (id: number, w: string, l?: number): Promise<TransactionRow[]> => (await impl()).getTransactionsForWeek(id, w, l);
export const getAnalogTransactions = async (id: number, w: string[], l?: number): Promise<TransactionRow[]> => (await impl()).getAnalogTransactions(id, w, l);
export const getSourceFiles = async (): Promise<any[]> => (await impl()).getSourceFiles();
export const getAccountsSummary = async (): Promise<any[]> => (await impl()).getAccountsSummary();
export const getInventory = async (): Promise<any> => (await impl()).getInventory();
export const getStatsArtifact = async (name: string): Promise<any> => (await impl()).getStatsArtifact(name);
