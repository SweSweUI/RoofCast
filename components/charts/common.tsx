'use client';
import type { ReactElement, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ResponsiveContainer } from 'recharts';
import { eurCompact } from '@/lib/format';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import type { CsvRow } from '@/lib/csv';

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

/**
 * Wraps a Recharts chart in a responsive container and overlays an
 * "Export CSV" button in the top-right corner. The download filename is
 * derived from the chart `name` plus the active view and selected company
 * (read from the URL), e.g. `cashflow_cfo_ummels.csv`.
 */
export function ChartFrame({
  name,
  height,
  rows,
  columns,
  children,
}: {
  name: string;
  height: number;
  rows: CsvRow[];
  columns?: string[];
  children: ReactElement;
}) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const company = sp.get('company') ?? 'portfolio';
  const view = pathname?.split('/').filter(Boolean)[0] ?? 'dashboard';
  const filename = `${name}_${view}_${company}`;

  return (
    <div className="relative">
      <ExportCsvButton
        rows={rows}
        filename={filename}
        columns={columns}
        className="absolute right-0 top-0 z-10"
      />
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
