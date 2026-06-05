'use client';
import { useApi } from './hooks';
import type { ForecastResult, Scenario } from '@/lib/types';

export interface NormalizedForecast {
  result: ForecastResult | null;
  companies: ForecastResult[] | null;
  loading: boolean;
  error: string | null;
}

/** Fetch /api/forecast and normalize portfolio vs single-company shape. */
export function useForecast(company: string, scenario: Scenario, extra = ''): NormalizedForecast {
  const url = `/api/forecast?company=${encodeURIComponent(company)}&scenario=${scenario}${extra}`;
  const { data, error, loading } = useApi<any>(url);
  const isPortfolio = company === 'portfolio';
  const result: ForecastResult | null = data
    ? isPortfolio
      ? data.portfolio
      : data
    : null;
  const companies: ForecastResult[] | null = isPortfolio ? data?.companies ?? null : null;
  return { result, companies, error, loading };
}

export function pickThreshold(r: ForecastResult | null): { threshold: number | null; label: string } {
  if (!r) return { threshold: null, label: 'Covenant' };
  const cash = r.covenants.find((c) => c.metric === 'min_cash_balance');
  const liq = r.covenants.find((c) => c.metric === 'min_13w_liquidity');
  const cov = cash ?? liq;
  return cov ? { threshold: cov.threshold, label: cov.name } : { threshold: null, label: 'Covenant' };
}
