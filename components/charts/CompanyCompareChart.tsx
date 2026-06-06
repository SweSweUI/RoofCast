'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { eurCompact } from '@/lib/format';
import { CHART, ChartFrame, ChartTooltip, axisTick, eurAxis } from './common';

export interface CompanyBar {
  name: string;
  value: number;
  risk?: 'low' | 'medium' | 'high';
}

/** Horizontal company comparison (e.g. net cash, min closing). */
export function CompanyCompareChart({ rows, label = 'Net cash' }: { rows: CompanyBar[]; label?: string }) {
  const exportRows = rows.map((r) => ({ company: r.name, [label]: r.value, risk: r.risk ?? '' }));
  return (
    <ChartFrame
      name="company-comparison"
      height={Math.max(160, rows.length * 46)}
      rows={exportRows}
      columns={['company', label, 'risk']}
    >
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={CHART.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={eurAxis} tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART.grid, fillOpacity: 0.4 }} />
        <Bar dataKey="value" name={label} radius={[0, 3, 3, 0]} maxBarSize={26}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.risk ? CHART.risk[r.risk] : CHART.cashin} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
