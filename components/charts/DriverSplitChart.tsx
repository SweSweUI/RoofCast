'use client';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForecastWeek } from '@/lib/types';
import { weekShort } from '@/lib/format';
import { CHART, ChartFrame, ChartTooltip, axisTick, eurAxis } from './common';

/** Stacked cash-out drivers per week + cash-in line for context. */
export function DriverSplitChart({ weeks }: { weeks: ForecastWeek[] }) {
  const data = weeks.map((w) => ({
    week: weekShort(w.weekStart),
    Materials: w.drivers.materials,
    Subcontractor: w.drivers.subcontractor,
    Labour: w.drivers.labour,
    Overhead: w.drivers.overhead,
    'Cash-in': w.forecastCashIn,
  }));
  return (
    <ChartFrame
      name="cash-out-drivers"
      height={300}
      rows={data}
      columns={['week', 'Materials', 'Subcontractor', 'Labour', 'Overhead', 'Cash-in']}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} angle={-30} textAnchor="end" height={42} />
        <YAxis tickFormatter={eurAxis} tick={axisTick} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Materials" stackId="out" fill={CHART.materials} maxBarSize={22} />
        <Bar dataKey="Subcontractor" stackId="out" fill={CHART.subcontractor} maxBarSize={22} />
        <Bar dataKey="Labour" stackId="out" fill={CHART.labour} maxBarSize={22} />
        <Bar dataKey="Overhead" stackId="out" fill={CHART.overhead} radius={[2, 2, 0, 0]} maxBarSize={22} />
        <Line type="monotone" dataKey="Cash-in" stroke={CHART.cashin} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartFrame>
  );
}
