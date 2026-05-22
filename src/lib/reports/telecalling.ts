import { format, subDays } from 'date-fns';
import type { EnquiryDoc } from '@/lib/firestore/queries';
import { flattenFollowUps, type FollowUpRow } from '@/lib/utils/analytics';
import { type DateRange } from '@/lib/utils/dateRanges';

export interface TelecallerStats {
  name: string;
  calls: number;
  connected: number;
  booked: number;
  dueToday: number;
  overdue: number;
  conversionPct: number;
}

function positive(row: FollowUpRow) {
  return /connect|interested|book|visit|completed|demo/i.test(`${row.status} ${row.outcome}`);
}

function booked(row: FollowUpRow) {
  return /book|appointment|visit|scheduled/i.test(`${row.status} ${row.outcome} ${row.enquiryStatus || ''}`);
}

export function buildTelecallingRows(enquiries: EnquiryDoc[]) {
  return flattenFollowUps(enquiries).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
}

export function filterTelecallingRows(rows: FollowUpRow[], range: DateRange, telecaller = 'all') {
  return rows.filter((r) => {
    const inRange = !!r.date && r.date >= range.start && r.date <= range.end;
    return inRange && (telecaller === 'all' || r.telecaller === telecaller);
  });
}

export function telecallerStats(rows: FollowUpRow[], today: DateRange): TelecallerStats[] {
  const map = new Map<string, TelecallerStats>();
  for (const row of rows) {
    const name = row.telecaller || 'Unassigned';
    const entry = map.get(name) || {
      name,
      calls: 0,
      connected: 0,
      booked: 0,
      dueToday: 0,
      overdue: 0,
      conversionPct: 0,
    };
    entry.calls += 1;
    if (positive(row)) entry.connected += 1;
    if (booked(row)) entry.booked += 1;
    if (row.nextFollowUpDate && row.nextFollowUpDate >= today.start && row.nextFollowUpDate <= today.end) entry.dueToday += 1;
    if (row.nextFollowUpDate && row.nextFollowUpDate < today.start && !booked(row)) entry.overdue += 1;
    entry.conversionPct = entry.calls > 0 ? (entry.booked / entry.calls) * 100 : 0;
    map.set(name, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.calls - a.calls);
}

export function telecallingSeries(rows: FollowUpRow[], days = 14) {
  const now = new Date();
  const seed = Array.from({ length: days }, (_, i) => {
    const day = subDays(now, days - i - 1);
    return { key: format(day, 'yyyy-MM-dd'), label: format(day, 'd MMM'), calls: 0, connected: 0, booked: 0 };
  });
  const byKey = new Map(seed.map((x) => [x.key, x]));
  for (const row of rows) {
    if (!row.date) continue;
    const bucket = byKey.get(format(row.date, 'yyyy-MM-dd'));
    if (!bucket) continue;
    bucket.calls += 1;
    if (positive(row)) bucket.connected += 1;
    if (booked(row)) bucket.booked += 1;
  }
  return seed;
}
