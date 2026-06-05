import { addWeeks, format, getISOWeek, parseISO, startOfISOWeek } from 'date-fns';

/** A WeekKey is the ISO-8601 date of the Monday starting that week. */
export type WeekKey = string;

export function keyToDate(key: WeekKey): Date {
  return parseISO(key);
}

export function weekKey(d: Date): WeekKey {
  return format(startOfISOWeek(d), 'yyyy-MM-dd');
}

export function addWeeksKey(key: WeekKey, n: number): WeekKey {
  return weekKey(addWeeks(keyToDate(key), n));
}

export function isoWeekOf(key: WeekKey): number {
  return getISOWeek(keyToDate(key));
}

/** Whole weeks between two keys (b - a). */
export function weekDiff(a: WeekKey, b: WeekKey): number {
  const ms = keyToDate(b).getTime() - keyToDate(a).getTime();
  return Math.round(ms / (7 * 24 * 3600 * 1000));
}

/** Monday of the current week for a given "today" date. */
export function currentWeekKey(today: Date): WeekKey {
  return weekKey(today);
}
