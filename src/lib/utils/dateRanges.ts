/**
 * Shared date-range presets used by Dashboard, Sales, Calls, Activity, Reports.
 * All times in IST-agnostic local time; pages convert to ms when querying Firestore.
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
  format,
} from 'date-fns';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'last_month'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export const PRESET_LABELS: Record<Exclude<DateRangePreset, 'custom'>, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  last_7_days: 'Last 7 days',
  this_month: 'This month',
  last_30_days: 'Last 30 days',
  last_month: 'Last month',
};

export function rangeFromPreset(
  preset: Exclude<DateRangePreset, 'custom'>,
  now: Date = new Date(),
): DateRange {
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: 'Today' };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y), label: 'Yesterday' };
    }
    case 'this_week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        label: 'This week',
      };
    case 'last_7_days':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), label: 'Last 7 days' };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now), label: 'This month' };
    case 'last_30_days':
      return {
        start: startOfDay(subDays(now, 29)),
        end: endOfDay(now),
        label: 'Last 30 days',
      };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm), label: 'Last month' };
    }
  }
}

/** Parse a value that might be a Firestore Timestamp, ISO string, Date, or ms number. */
export function toDateSafe(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null) {
    const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof v.toDate === 'function') {
      try {
        return v.toDate();
      } catch {
        return null;
      }
    }
    const s = v.seconds ?? v._seconds;
    if (typeof s === 'number') return new Date(s * 1000);
  }
  return null;
}

export function inRange(value: unknown, range: DateRange | null): boolean {
  if (!range) return true;
  const d = toDateSafe(value);
  if (!d) return false;
  return d >= range.start && d <= range.end;
}

export function formatRangeLabel(r: DateRange): string {
  return `${format(r.start, 'd MMM yyyy')} – ${format(r.end, 'd MMM yyyy')}`;
}

export function formatINR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('en-IN').format(value);
}
