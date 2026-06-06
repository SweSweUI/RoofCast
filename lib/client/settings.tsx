'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ForecastParams, WeatherRiskMode } from '@/lib/types';

/**
 * Global, persisted dashboard settings. This is the single "Settings page"
 * model for the web app: every dashboard reads these and renders the result, so
 * the dashboards are pure displays. Mirrors the iOS Settings page.
 */
export interface AltisSettings {
  horizonWeeks: number;
  weatherRiskMode: WeatherRiskMode;
  weatherMediumThreshold: number;
  weatherHighThreshold: number;
  weatherShiftHigh: number;
  weatherShiftMedium: number;
  covenantFloor: number;
  weeklyOtherCashOut: number;
  openingCash: number | null; // null = use the modelled per-company default
  drivers: { materials: number; subcontractor: number; labour: number; overhead: number };
  baselineLookbackWeeks: number;
  language: 'en' | 'nl';
}

export const HORIZON_OPTIONS = [16, 26, 52] as const;

export const WEATHER_RULES: {
  mode: WeatherRiskMode;
  label: string;
  medium: number;
  high: number;
  en: string;
  nl: string;
}[] = [
  { mode: 'rain_2mm_workdays', label: 'Base rain rule', medium: 2, high: 3,
    en: 'High risk when 3+ workdays in a week have at least 2mm rain.',
    nl: 'Hoog risico bij 3+ werkdagen per week met minimaal 2mm regen.' },
  { mode: 'heavy_5mm_workdays', label: 'Heavy rain rule', medium: 1, high: 2,
    en: 'High risk when 2+ workdays have 5mm or more rain.',
    nl: 'Hoog risico bij 2+ werkdagen met 5mm regen of meer.' },
  { mode: 'bad_workdays', label: 'Site disruption rule', medium: 1, high: 2,
    en: 'High risk when 2+ workdays meet the operational bad-weather definition.',
    nl: 'Hoog risico bij 2+ werkdagen volgens de operationele slecht-weer definitie.' },
];

export const DEFAULT_SETTINGS: AltisSettings = {
  horizonWeeks: 16,
  weatherRiskMode: 'rain_2mm_workdays',
  weatherMediumThreshold: 2,
  weatherHighThreshold: 3,
  weatherShiftHigh: 0.25,
  weatherShiftMedium: 0.12,
  covenantFloor: 750_000,
  weeklyOtherCashOut: 0,
  openingCash: null,
  drivers: { materials: 0.32, subcontractor: 0.18, labour: 0.22, overhead: 0.1 },
  baselineLookbackWeeks: 8,
  language: 'en',
};

const STORAGE_KEY = 'altis.settings.v1';

interface SettingsContextValue {
  settings: AltisSettings;
  update: (patch: Partial<AltisSettings>) => void;
  setDriver: (key: keyof AltisSettings['drivers'], value: number) => void;
  reset: () => void;
  isDefault: boolean;
  /** Forecast API override query string, e.g. "&horizonWeeks=16&...". */
  query: string;
  /** The same overrides as a Partial<ForecastParams> (for the agent). */
  overrides: Partial<ForecastParams>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function load(): AltisSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      drivers: { ...DEFAULT_SETTINGS.drivers, ...(parsed.drivers ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function buildOverrides(s: AltisSettings): Partial<ForecastParams> {
  return {
    horizonWeeks: s.horizonWeeks,
    weatherRiskMode: s.weatherRiskMode,
    weatherMediumThreshold: s.weatherMediumThreshold,
    weatherHighThreshold: s.weatherHighThreshold,
    weatherShiftHigh: s.weatherShiftHigh,
    weatherShiftMedium: s.weatherShiftMedium,
    covenantFloorOverride: s.covenantFloor,
    weeklyOtherCashOut: s.weeklyOtherCashOut,
    baselineLookbackWeeks: s.baselineLookbackWeeks,
    drivers: s.drivers,
    ...(s.openingCash != null ? { openingCash: s.openingCash } : {}),
  };
}

export function buildQuery(s: AltisSettings): string {
  const p = new URLSearchParams();
  p.set('horizonWeeks', String(s.horizonWeeks));
  p.set('weatherRiskMode', s.weatherRiskMode);
  p.set('weatherMediumThreshold', String(s.weatherMediumThreshold));
  p.set('weatherHighThreshold', String(s.weatherHighThreshold));
  p.set('weatherShiftHigh', String(s.weatherShiftHigh));
  p.set('weatherShiftMedium', String(s.weatherShiftMedium));
  p.set('covenantFloor', String(s.covenantFloor));
  p.set('weeklyOtherCashOut', String(s.weeklyOtherCashOut));
  p.set('baselineLookbackWeeks', String(s.baselineLookbackWeeks));
  p.set('materials', String(s.drivers.materials));
  p.set('subcontractor', String(s.drivers.subcontractor));
  p.set('labour', String(s.drivers.labour));
  p.set('overhead', String(s.drivers.overhead));
  if (s.openingCash != null) p.set('openingCash', String(s.openingCash));
  return `&${p.toString()}`;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AltisSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    setSettings(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [settings, hydrated]);

  const update = useCallback((patch: Partial<AltisSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);
  const setDriver = useCallback((key: keyof AltisSettings['drivers'], value: number) => {
    setSettings((prev) => ({ ...prev, drivers: { ...prev.drivers, [key]: value } }));
  }, []);
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = useMemo<SettingsContextValue>(() => {
    const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);
    return {
      settings,
      update,
      setDriver,
      reset,
      isDefault,
      query: buildQuery(settings),
      overrides: buildOverrides(settings),
    };
  }, [settings, update, setDriver, reset]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
