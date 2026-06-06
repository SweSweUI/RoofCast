import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { RiskLevel } from '@/lib/types';
import { InfoTip } from './ui/info-tip';

export function Card({
  children,
  className,
  title,
  subtitle,
  right,
  pad = true,
  info,
  infoAlign,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  pad?: boolean;
  /** Plain-language explanation shown via an info icon next to the title. */
  info?: string;
  infoAlign?: 'left' | 'right';
}) {
  return (
    <section
      className={clsx(
        'rounded-lg border border-panel-line bg-panel shadow-card',
        className,
      )}
    >
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-panel-line px-4 py-3">
          <div>
            {title && (
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {title}
                {info && (
                  <InfoTip
                    text={info}
                    align={infoAlign}
                    label={typeof title === 'string' ? `About ${title}` : 'More information'}
                  />
                )}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-2xs text-ink-muted">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={clsx(pad && 'p-4')}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = 'default',
  hint,
  info,
  infoAlign,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  hint?: string;
  /** Plain-language explanation shown via an info icon next to the label. */
  info?: string;
  infoAlign?: 'left' | 'right';
}) {
  const toneCls = {
    default: 'text-ink',
    good: 'text-risk-low',
    warn: 'text-risk-medium',
    bad: 'text-risk-high',
  }[tone];
  return (
    <div className="rounded-lg border border-panel-line bg-panel px-4 py-3 shadow-card" title={hint}>
      <div className="flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">
        <span>{label}</span>
        {info && <InfoTip text={info} align={infoAlign} label={`About ${label}`} />}
      </div>
      <div className={clsx('mt-1 text-xl font-semibold tnum', toneCls)}>{value}</div>
      {sub && <div className="mt-0.5 text-2xs text-ink-muted tnum">{sub}</div>}
    </div>
  );
}

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'bg-green-50 text-risk-low ring-green-600/20',
  medium: 'bg-amber-50 text-risk-medium ring-amber-600/20',
  high: 'bg-red-50 text-risk-high ring-red-600/20',
};
const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium ring-1 ring-inset',
        RISK_STYLE[level],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label ?? RISK_LABEL[level]}
    </span>
  );
}

export function Pill({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'live' | 'muted';
  title?: string;
}) {
  const cls = {
    neutral: 'bg-panel-sunken text-ink-muted ring-panel-line',
    accent: 'bg-accent-soft text-accent ring-accent/20',
    live: 'bg-teal-50 text-accent ring-accent/30',
    muted: 'bg-slate-100 text-ink-faint ring-panel-line',
  }[tone];
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium ring-1 ring-inset', cls)}
      title={title}
    >
      {children}
    </span>
  );
}

/** Marks a value that is a modelling assumption rather than observed data. */
export function AssumptionTag({ children = 'assumption' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">
      {children}
    </span>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h1 className="text-lg font-semibold text-ink">{children}</h1>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-panel-line bg-panel-sunken p-6 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[120px] animate-pulse items-center justify-center rounded-lg border border-panel-line bg-panel-sunken p-6 text-sm text-ink-faint">
      {label}
    </div>
  );
}

// compact table helpers
export function Th({
  children,
  className,
  right,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  right?: boolean;
  colSpan?: number;
}) {
  return (
    <th
      colSpan={colSpan}
      className={clsx(
        'border-b border-panel-line px-2.5 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint',
        right ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({
  children,
  className,
  right,
  mono,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  right?: boolean;
  mono?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={clsx(
        'border-b border-panel-line/70 px-2.5 py-1.5 text-sm text-ink-soft',
        right && 'text-right tnum',
        mono && 'font-mono text-2xs',
        className,
      )}
    >
      {children}
    </td>
  );
}
