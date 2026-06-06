'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scenario } from '@/lib/types';

export interface DashboardState {
  scenario: Scenario;
  company: string; // 'portfolio' or a company code
  setCompany: (c: string) => void;
  setParam: (key: string, value: string) => void;
}

export function useDashboardState(): DashboardState {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const scenario: Scenario = 'base';
  const company = sp.get('company') ?? 'portfolio';

  useEffect(() => {
    if (!sp.has('scenario')) return;
    const next = new URLSearchParams(sp.toString());
    next.delete('scenario');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [sp, router, pathname]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      next.delete('scenario');
      next.set(key, value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [sp, router, pathname],
  );

  return {
    scenario,
    company,
    setCompany: (c) => setParam('company', c),
    setParam,
  };
}

interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Minimal fetcher with keep-previous-data (no flicker on company/view changes). */
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
