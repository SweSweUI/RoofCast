'use client';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Scenario } from '@/lib/types';
import { weekShort } from '@/lib/format';
import { CHART, ChartTooltip, axisTick, eurAxis } from './common';

type ClosingPoint = { weekStart: string; closingCash: number };

/** Closing-cash trajectory per scenario. `series` keyed by scenario. */
export function ScenarioCompareChart({
  series,
}: {
  series: Partial<Record<Scenario, ClosingPoint[]>>;
}) {
  const base = series.base ?? series.wet_quarter ?? series.dry_quarter ?? [];
  const data = base.map((_, i) => ({
    week: weekShort(base[i].weekStart),
    Base: series.base?.[i]?.closingCash,
    'Wet quarter': series.wet_quarter?.[i]?.closingCash,
    'Dry quarter': series.dry_quarter?.[i]?.closingCash,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} angle={-30} textAnchor="end" height={42} />
        <YAxis tickFormatter={eurAxis} tick={axisTick} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="Dry quarter" stroke={CHART.scenario.dry_quarter} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Base" stroke={CHART.scenario.base} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Wet quarter" stroke={CHART.scenario.wet_quarter} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
