import { format, subDays } from 'date-fns';
import type { ActivityLogDoc, AppointmentDoc, EnquiryDoc, SaleDoc, UserDoc } from '@/lib/firestore/queries';
import { inRange, toDateSafe, type DateRange } from '@/lib/utils/dateRanges';
import type { NormalizedSaleRow } from '@/lib/reports/sales';
import { getNormalizedSaleDate, saleInvoiceFaceTotal } from '@/lib/reports/sales';

type SaleLike = SaleDoc | NormalizedSaleRow;

function isNormalizedSale(sale: SaleLike): sale is NormalizedSaleRow {
  return 'sourceKind' in sale && 'total' in sale;
}

export function getSaleDate(sale: SaleLike): Date | null {
  if (isNormalizedSale(sale)) return sale.date;
  return (
    getNormalizedSaleDate(sale)
  );
}

export function getSaleTotal(sale: SaleLike): number {
  if (isNormalizedSale(sale)) return sale.total;
  return saleInvoiceFaceTotal(sale);
}

export function getSalePaid(sale: SaleLike): number {
  if (isNormalizedSale(sale)) return sale.paid;
  return Number(sale.amountPaid ?? sale.paidAmount ?? 0) || 0;
}

export function getAppointmentDate(appt: AppointmentDoc): Date | null {
  return (
    toDateSafe(appt.start) ??
    toDateSafe(appt.date) ??
    toDateSafe(appt.appointmentDate) ??
    toDateSafe(appt.startTime) ??
    toDateSafe(appt.createdAt)
  );
}

export function normalizeStatus(status?: string): string {
  return String(status || 'scheduled').toLowerCase().replace(/\s+/g, '_');
}

export function appointmentStatusLabel(status?: string): string {
  const s = normalizeStatus(status);
  if (s === 'completed') return 'Completed';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  if (s === 'rescheduled') return 'Rescheduled';
  if (s === 'no_show' || s === 'noshow') return 'No-show';
  return 'Scheduled';
}

export interface FollowUpRow {
  id: string;
  enquiryId: string;
  customerName: string;
  phone: string;
  date: Date | null;
  nextFollowUpDate: Date | null;
  status: string;
  outcome: string;
  note: string;
  telecaller: string;
  enquiryStatus?: string;
}

export function flattenFollowUps(enquiries: EnquiryDoc[]): FollowUpRow[] {
  return enquiries.flatMap((e) => {
    const followUps = Array.isArray(e.followUps) ? e.followUps : [];
    return followUps.map((f, index) => ({
      id: `${e.id}-${f.id || index}`,
      enquiryId: e.id,
      customerName: e.customerName || e.name || 'Unknown',
      phone: e.phone || e.mobile || '',
      date: toDateSafe(f.date),
      nextFollowUpDate: toDateSafe(f.nextFollowUpDate),
      status: String(f.status || f.response || 'Pending'),
      outcome: String(f.outcome || f.response || 'Not recorded'),
      note: String(f.note || f.notes || ''),
      telecaller: String(f.byName || f.by || f.telecaller || e.telecallerName || e.assignedToName || 'Unassigned'),
      enquiryStatus: e.status,
    }));
  });
}

export function getUserName(userId: string | undefined, users: UserDoc[]): string {
  if (!userId) return 'Unknown';
  const user = users.find((u) => u.id === userId || u.uid === userId);
  return user?.displayName || user?.nickname || user?.email || userId;
}

export function summarizeSales<T extends SaleLike>(sales: T[], range?: DateRange | null) {
  const filtered = range ? sales.filter((s) => inRange(getSaleDate(s), range)) : sales;
  const total = filtered.reduce((sum, s) => sum + getSaleTotal(s), 0);
  const paid = filtered.reduce((sum, s) => sum + getSalePaid(s), 0);
  return {
    rows: filtered,
    count: filtered.length,
    total,
    paid,
    outstanding: Math.max(total - paid, 0),
  };
}

export function buildDailySalesSeries(sales: SaleLike[], days = 30) {
  const now = new Date();
  const seed = Array.from({ length: days }, (_, i) => {
    const day = subDays(now, days - i - 1);
    return {
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'd MMM'),
      sales: 0,
      receipts: 0,
      invoices: 0,
    };
  });
  const byKey = new Map(seed.map((d) => [d.key, d]));
  for (const sale of sales) {
    const d = getSaleDate(sale);
    if (!d) continue;
    const key = format(d, 'yyyy-MM-dd');
    const row = byKey.get(key);
    if (!row) continue;
    row.sales += getSaleTotal(sale);
    row.receipts += getSalePaid(sale);
    row.invoices += 1;
  }
  return seed;
}

export function buildCallSeries(followUps: FollowUpRow[], days = 14) {
  const now = new Date();
  const seed = Array.from({ length: days }, (_, i) => {
    const day = subDays(now, days - i - 1);
    return {
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'd MMM'),
      calls: 0,
      booked: 0,
    };
  });
  const byKey = new Map(seed.map((d) => [d.key, d]));
  for (const f of followUps) {
    if (!f.date) continue;
    const row = byKey.get(format(f.date, 'yyyy-MM-dd'));
    if (!row) continue;
    row.calls += 1;
    if (/book/i.test(`${f.status} ${f.outcome} ${f.enquiryStatus || ''}`)) row.booked += 1;
  }
  return seed;
}

export function buildAppointmentStatusSeries(appointments: AppointmentDoc[], range?: DateRange | null) {
  const filtered = range
    ? appointments.filter((a) => inRange(getAppointmentDate(a), range))
    : appointments;
  const counts = new Map<string, number>();
  for (const appt of filtered) {
    const label = appointmentStatusLabel(appt.status);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
}

export function topPerformersFromActivity(logs: ActivityLogDoc[], users: UserDoc[], range: DateRange | null) {
  const filtered = logs.filter((l) => inRange(l.timestamp, range));
  const counts = new Map<string, { user: string; actions: number; sales: number; calls: number; appointments: number }>();
  for (const log of filtered) {
    const id = log.userId || log.userEmail || 'unknown';
    const entry = counts.get(id) || {
      user: log.userName || getUserName(id, users),
      actions: 0,
      sales: 0,
      calls: 0,
      appointments: 0,
    };
    entry.actions += 1;
    if (log.module === 'Sales') entry.sales += 1;
    if (log.module === 'Telecalling') entry.calls += 1;
    if (log.module === 'Appointments') entry.appointments += 1;
    counts.set(id, entry);
  }
  return Array.from(counts.values()).sort((a, b) => b.actions - a.actions).slice(0, 8);
}
