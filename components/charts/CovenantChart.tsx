'use client';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForecastWeek } from '@/lib/types';
import { weekShort } from '@/lib/format';
import { CHART, ChartFrame, ChartTooltip, axisTick, eurAxis } from './common';

/** Closing cash vs covenant floor; headroom shaded. */
export function CovenantChart({
  weeks,
  threshold,
  thresholdLabel = 'Covenant floor',
}: {
  weeks: ForecastWeek[];
  threshold: number | null;
  thresholdLabel?: string;
}) {
  const data = weeks.map((w) => ({
    week: weekShort(w.weekStart),
    'Closing cash': w.closingCash,
    Headroom: w.covenantHeadroom ?? undefined,
  }));
  return (
    <ChartFrame
      name="covenant-headroom"
      height={280}
      rows={data}
      columns={['week', 'Closing cash', 'Headroom']}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} angle={-30} textAnchor="end" height={42} />
        <YAxis tickFormatter={eurAxis} tick={axisTick} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {threshold != null && (
          <ReferenceLine
            y={threshold}
            stroke={CHART.risk.high}
            strokeDasharray="4 3"
            label={{ value: thresholdLabel, position: 'insideTopRight', fill: CHART.risk.high, fontSize: 10 }}
          />
        )}
        <Area type="monotone" dataKey="Closing cash" stroke={CHART.closing} strokeWidth={2} fill={CHART.cashin} fillOpacity={0.08} />
      </ComposedChart>
    </ChartFrame>
  );
}
