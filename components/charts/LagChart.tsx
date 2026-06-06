'use client';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CsvRow } from '@/lib/csv';
import { CHART, ChartFrame, axisTick } from './common';

export interface LagPoint {
  lag: number;
  r_rain2mm_net: number;
  r_rain2mm_credit: number;
}

/** Correlation r between rain workdays (week t) and revenue (week t+lag). */
export function LagChart({ data }: { data: LagPoint[] }) {
  return (
    <ChartFrame
      name="weather-lag-correlation"
      height={260}
      rows={data as unknown as CsvRow[]}
      columns={['lag', 'r_rain2mm_net', 'r_rain2mm_credit']}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="lag" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} label={{ value: 'lag (weeks)', position: 'insideBottom', offset: -2, fontSize: 10, fill: CHART.axis }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={42} domain={[-0.4, 0.4]} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 6, border: `1px solid ${CHART.grid}` }}
          formatter={(v: number) => v.toFixed(3)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke={CHART.axis} />
        <ReferenceLine x={5} stroke={CHART.risk.medium} strokeDasharray="3 3" label={{ value: 'lag 5', fontSize: 9, fill: CHART.risk.medium }} />
        <Line type="monotone" dataKey="r_rain2mm_net" name="rain → net revenue" stroke={CHART.scenario.base} strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="r_rain2mm_credit" name="rain → facturation" stroke={CHART.cashin} strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ChartFrame>
  );
}
