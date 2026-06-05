'use client';
import {
  Bar,
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
  const liveCount = weeks.filter((w) => w.isLiveWeather).length;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        {liveCount > 0 && (
          <ReferenceArea
            x1={data[0].week}
            x2={data[Math.max(0, liveCount - 1)].week}
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
      </ComposedChart>
    </ResponsiveContainer>
  );
}
