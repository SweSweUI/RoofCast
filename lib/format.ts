import { addDays, format, parseISO } from 'date-fns';

export function eur(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '–';
  return `€${Math.round(x).toLocaleString('en-US')}`;
}

/** Compact euro: €1.2M / €189k / €820. */
export function eurCompact(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '–';
  const a = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}€${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}€${Math.round(a / 1_000)}k`;
  return `${sign}€${Math.round(a)}`;
}

export function signedEur(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '–';
  const body = `€${Math.round(Math.abs(x)).toLocaleString('en-US')}`;
  return x < 0 ? `−${body}` : `+${body}`;
}

export function pct(x: number | null | undefined, digits = 0): string {
  if (x == null || !Number.isFinite(x)) return '–';
  return `${(x * 100).toFixed(digits)}%`;
}

export function num(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '–';
  return Math.round(x).toLocaleString('en-US');
}

/** "1 Jun" for a week-start key. */
export function weekShort(weekStart: string): string {
  try {
    return format(parseISO(weekStart), 'd MMM');
  } catch {
    return weekStart;
  }
}

/** "1–7 Jun" range for a Monday week key. */
export function weekRange(weekStart: string): string {
  try {
    const a = parseISO(weekStart);
    const b = addDays(a, 6);
    const sameMonth = format(a, 'MMM') === format(b, 'MMM');
    return sameMonth
      ? `${format(a, 'd')}–${format(b, 'd MMM')}`
      : `${format(a, 'd MMM')} – ${format(b, 'd MMM')}`;
  } catch {
    return weekStart;
  }
}

export function dateShort(d: string): string {
  try {
    return format(parseISO(d), 'd MMM yyyy');
  } catch {
    return d;
  }
}
