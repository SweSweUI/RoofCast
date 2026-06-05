'use client';
import type { ReactNode } from 'react';
import { eurCompact } from '@/lib/format';

export const CHART = {
  cashin: '#0d9488', // teal-600
  cashout: '#94a3b8', // slate-400
  closing: '#0f172a', // ink
  baseline: '#cbd5e1', // slate-300
  grid: '#e2e8f0',
  axis: '#94a3b8',
  materials: '#0e7490', // cyan-700
  subcontractor: '#0d9488', // teal-600
  labour: '#64748b', // slate-500
  overhead: '#cbd5e1', // slate-300
  risk: { low: '#15803d', medium: '#b45309', high: '#b91c1c' },
  scenario: { base: '#0f172a', wet_quarter: '#b91c1c', dry_quarter: '#0d9488' },
};

export function ChartTooltip({ active, payload, label, currency = true }: any): ReactNode {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-panel-line bg-panel/95 px-2.5 py-1.5 text-2xs shadow-card backdrop-blur">
      <div className="mb-1 font-semibold text-ink">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.fill }} />
            {p.name}
          </span>
          <span className="font-medium tnum text-ink">
            {currency ? eurCompact(p.value) : Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export const axisTick = { fill: CHART.axis, fontSize: 10 };
export const eurAxis = (v: number) => eurCompact(v);
