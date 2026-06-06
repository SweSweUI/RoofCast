'use client';
import { useEffect, useState } from 'react';
import {
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import clsx from 'clsx';
import type { ForecastWeek } from '@/lib/types';
import { weekShort } from '@/lib/format';
import { CHART, ChartTooltip, axisTick, eurAxis } from './common';

export function CashflowChart({ weeks }: { weeks: ForecastWeek[] }) {
  const data = weeks.map((w) => ({
    week: weekShort(w.weekStart),
    'Cash-in': w.forecastCashIn,
    'Cash-out': w.forecastCashOut,
    'Closing cash': w.closingCash,
    live: w.isLiveWeather,
  }));
  const n = data.length;
  const liveCount = weeks.filter((w) => w.isLiveWeather).length;

  // Zoom range (indices into data). Reset whenever the horizon changes.
  const [range, setRange] = useState<[number, number]>([0, Math.max(0, n - 1)]);
  useEffect(() => {
    setRange([0, Math.max(0, n - 1)]);
  }, [n]);

  const start = Math.min(range[0], n - 1);
  const end = Math.min(range[1], n - 1);
  const presets = [
    { label: '1–8', a: 0, b: 7 },
    { label: '1–16', a: 0, b: 15 },
    { label: 'All', a: 0, b: n - 1 },
  ].filter((p) => p.label === 'All' || p.b < n);

  const isActive = (a: number, b: number) => start === a && end === Math.min(b, n - 1);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">Zoom</span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setRange([p.a, Math.min(p.b, n - 1)])}
            className={clsx(
              'rounded border px-2 py-0.5 text-2xs font-semibold transition-colors',
              isActive(p.a, p.b)
                ? 'border-ink bg-ink text-white'
                : 'border-panel-line bg-panel-sunken text-ink-muted hover:border-accent/40 hover:text-accent',
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-1 text-2xs text-ink-faint">or drag the slider below</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          {liveCount > 0 && start < liveCount && (
            <ReferenceArea
              x1={data[start].week}
              x2={data[Math.min(liveCount - 1, end)].week}
              fill={CHART.cashin}
              fillOpacity={0.05}
              ifOverflow="extendDomain"
            />
          )}
          <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} angle={-30} textAnchor="end" height={42} />
          <YAxis yAxisId="left" tickFormatter={eurAxis} tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={eurAxis} tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="Cash-in" fill={CHART.cashin} radius={[2, 2, 0, 0]} maxBarSize={22} />
          <Bar yAxisId="left" dataKey="Cash-out" fill={CHART.cashout} radius={[2, 2, 0, 0]} maxBarSize={22} />
          <Line yAxisId="right" type="monotone" dataKey="Closing cash" stroke={CHART.closing} strokeWidth={2} dot={{ r: 2 }} />
          <Brush
            dataKey="week"
            height={20}
            travellerWidth={8}
            stroke={CHART.closing}
            startIndex={start}
            endIndex={end}
            onChange={(r: any) => {
              if (r && typeof r.startIndex === 'number' && typeof r.endIndex === 'number') {
                setRange([r.startIndex, r.endIndex]);
              }
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
