'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scenario } from '@/lib/types';
import { SCENARIOS } from '@/lib/types';

export interface DashboardState {
  scenario: Scenario;
  company: string; // 'portfolio' or a company code
  setScenario: (s: Scenario) => void;
  setCompany: (c: string) => void;
  setParam: (key: string, value: string) => void;
  qs: string; // current scenario+company query string for API calls
}

export function useDashboardState(): DashboardState {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const scenarioRaw = sp.get('scenario') as Scenario | null;
  const scenario: Scenario = scenarioRaw && SCENARIOS.includes(scenarioRaw) ? scenarioRaw : 'base';
  const company = sp.get('company') ?? 'portfolio';

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      next.set(key, value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [sp, router, pathname],
  );

  const qs = `scenario=${scenario}&company=${encodeURIComponent(company)}`;
  return {
    scenario,
    company,
    setScenario: (s) => setParam('scenario', s),
    setCompany: (c) => setParam('company', c),
    setParam,
    qs,
  };
}

interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Minimal fetcher with keep-previous-data (no flicker on scenario change). */
export function useApi<T = unknown>(url: string | null): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: !!url });
  const lastData = useRef<T | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setState({ data: lastData.current, error: null, loading: true });
    fetch(url)
      .then(async (r) => {
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setState({ data: lastData.current, error: body?.message ?? `HTTP ${r.status}`, loading: false });
          return;
        }
        lastData.current = body;
        setState({ data: body, error: null, loading: false });
      })
      .catch((e) => {
        if (!cancelled) setState({ data: lastData.current, error: String(e), loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
