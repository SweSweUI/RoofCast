'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { eurCompact } from '@/lib/format';
import type { CsvRow } from '@/lib/csv';
import { CHART, ChartFrame, ChartTooltip, axisTick, eurAxis } from './common';

export interface WetDryPoint {
  lag: number;
  wet_mean: number;
  dry_mean: number;
  pct_diff: number;
  p_value: number;
}

/** Mean revenue following wet vs dry weeks, by lag. */
export function WetDryChart({ data }: { data: WetDryPoint[] }) {
  const rows = data.map((d) => ({
    lag: `lag ${d.lag}`,
    'After dry weeks': Math.round(d.dry_mean),
    'After wet weeks': Math.round(d.wet_mean),
  }));
  return (
    <ChartFrame
      name="wet-dry-revenue"
      height={260}
      rows={data as unknown as CsvRow[]}
      columns={['lag', 'wet_mean', 'dry_mean', 'pct_diff', 'p_value']}
    >
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="lag" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis tickFormatter={eurAxis} tick={axisTick} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART.grid, fillOpacity: 0.4 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="After dry weeks" fill={CHART.scenario.dry_quarter} radius={[2, 2, 0, 0]} maxBarSize={34} />
        <Bar dataKey="After wet weeks" fill={CHART.scenario.wet_quarter} radius={[2, 2, 0, 0]} maxBarSize={34} />
      </BarChart>
    </ChartFrame>
  );
}
