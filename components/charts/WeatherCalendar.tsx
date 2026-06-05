'use client';
import clsx from 'clsx';
import type { RiskLevel } from '@/lib/types';
import { weekRange } from '@/lib/format';

export interface WeatherCell {
  weekStart: string;
  weekIndex: number;
  isLive: boolean;
  source: string;
  expectedRainWorkdays: number;
  delayScore: number;
  risk: RiskLevel;
}

const BG: Record<RiskLevel, string> = {
  low: 'bg-green-50 border-green-200',
  medium: 'bg-amber-50 border-amber-200',
  high: 'bg-red-50 border-red-200',
};
const DOT: Record<RiskLevel, string> = {
  low: 'bg-risk-low',
  medium: 'bg-risk-medium',
  high: 'bg-risk-high',
};

/** 13-week weather-risk calendar. Live-forecast weeks marked distinctly. */
export function WeatherCalendar({
  series,
  onPick,
  activeWeek,
}: {
  series: WeatherCell[];
  onPick?: (weekStart: string) => void;
  activeWeek?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-13">
      {series.map((c) => (
        <button
          key={c.weekStart}
          onClick={() => onPick?.(c.weekStart)}
          className={clsx(
            'flex flex-col items-start gap-1 rounded-md border p-2 text-left transition-shadow',
            BG[c.risk],
            onPick && 'hover:shadow-card',
            activeWeek === c.weekStart && 'ring-2 ring-ink',
          )}
          title={`${c.risk} risk · delay score ${c.delayScore} · ${c.source}`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-[10px] font-medium text-ink-muted">W{c.weekIndex}</span>
            <span className={clsx('h-2 w-2 rounded-full', DOT[c.risk])} />
          </div>
          <div className="text-2xs font-medium text-ink">{weekRange(c.weekStart)}</div>
          <div className="text-lg font-semibold tnum text-ink">{c.expectedRainWorkdays}</div>
          <div className="text-[10px] text-ink-faint">rain workdays</div>
          <span
            className={clsx(
              'mt-0.5 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide',
              c.isLive ? 'bg-accent-soft text-accent' : 'bg-slate-100 text-ink-faint',
            )}
          >
            {c.isLive ? 'live' : 'seasonal'}
          </span>
        </button>
      ))}
    </div>
  );
}
