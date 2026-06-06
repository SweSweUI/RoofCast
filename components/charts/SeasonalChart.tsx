'use client';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { CsvRow } from '@/lib/csv';
import { CHART, ChartFrame, ChartTooltip, axisTick, eurAxis } from './common';

// Average monthly facturation across all four opcos, 2023–2026 — the historical
// seasonal profile (same series as the pitch deck's "Billing is seasonal" slide).
// The forecast baseline learns this ISO-week shape per company, then the weather
// model shifts timing on top. Two dips: January (winter) and August (bouwvak),
// with a strong autumn peak in September.
const MONTHLY: { month: string; revenue: number; tag?: 'low' | 'peak' }[] = [
  { month: 'Jan', revenue: 1_340_000, tag: 'low' },
  { month: 'Feb', revenue: 2_250_000 },
  { month: 'Mar', revenue: 3_260_000 },
  { month: 'Apr', revenue: 2_940_000 },
  { month: 'May', revenue: 2_540_000 },
  { month: 'Jun', revenue: 2_370_000 },
  { month: 'Jul', revenue: 2_870_000 },
  { month: 'Aug', revenue: 1_230_000, tag: 'low' },
  { month: 'Sep', revenue: 3_430_000, tag: 'peak' },
  { month: 'Oct', revenue: 3_060_000 },
  { month: 'Nov', revenue: 2_810_000 },
  { month: 'Dec', revenue: 2_920_000 },
];

const DIP = '#b45309'; // amber — winter low & bouwvak
const PEAK = '#0f766e'; // deep teal — autumn peak

/** Highlights the seasonal dips (Jan, Aug) and the autumn peak (Sep). */
function SeasonDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const tag = payload?.tag as 'low' | 'peak' | undefined;
  const fill = tag === 'low' ? DIP : tag === 'peak' ? PEAK : CHART.cashin;
  return <circle cx={cx} cy={cy} r={tag ? 5 : 3.5} fill={fill} stroke="#fff" strokeWidth={2} />;
}

/** "Billing is seasonal" — average monthly revenue across the portfolio. */
export function SeasonalChart() {
  return (
    <div>
      <ChartFrame
        name="seasonality"
        height={260}
        rows={MONTHLY as unknown as CsvRow[]}
        columns={['month', 'revenue']}
      >
        <AreaChart data={MONTHLY} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} />
          <YAxis tickFormatter={eurAxis} tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.grid }} />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Avg monthly revenue"
            stroke={CHART.cashin}
            strokeWidth={3}
            fill={CHART.cashin}
            fillOpacity={0.12}
            dot={<SeasonDot />}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartFrame>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: DIP }} />
          Winter low (Jan) &amp; bouwvak (Aug)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: PEAK }} />
          Autumn peak (Sep)
        </span>
      </div>
      <p className="mt-2 text-2xs leading-relaxed text-ink-faint">
        The forecast baseline learns this ISO-week pattern per company; the weather model only shifts
        the <em>timing</em> on top of it.
      </p>
    </div>
  );
}
