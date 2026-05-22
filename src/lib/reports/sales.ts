import { format } from 'date-fns';
import type { CenterDoc, EnquiryDoc, SaleDoc } from '@/lib/firestore/queries';
import { toDateSafe, type DateRange } from '@/lib/utils/dateRanges';

type AnyObj = Record<string, unknown>;

export type SalesPaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue' | 'cancelled';

export interface NormalizedSaleRow {
  id: string;
  sourceKind: 'invoice' | 'enquiry';
  saleId?: string;
  enquiryId?: string;
  visitIndex?: number;
  invoiceNumber: string;
  date: Date | null;
  customerName: string;
  phone: string;
  email: string;
  centerId: string;
  centerName: string;
  executive: string;
  source: string;
  company: string;
  total: number;
  taxable: number;
  gst: number;
  paid: number;
  outstanding: number;
  status: SalesPaymentStatus;
  discountMrpBasis: number;
  discountOffMrp: number;
  products: string[];
  paymentHistory: Array<{
    amount: number;
    mode: string;
    referenceNumber?: string;
    remarks?: string;
    date?: string;
  }>;
  raw: AnyObj;
}

export interface SalesSummary {
  rows: NormalizedSaleRow[];
  count: number;
  total: number;
  paid: number;
  outstanding: number;
  taxable: number;
  gst: number;
  avgDiscountPct: number;
}

function baseCenterMatchKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+(center|centre|c\.?tr\.?|branch)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function str(v: unknown, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  return String(v).trim() || fallback;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getPath(obj: AnyObj | undefined | null, path: string): unknown {
  if (!obj) return undefined;
  return path.split('.').reduce<unknown>((cur, key) => {
    if (!cur || typeof cur !== 'object') return undefined;
    return (cur as AnyObj)[key];
  }, obj);
}

export function buildCenterResolver(centers: CenterDoc[]) {
  const byId = new Map(centers.map((c) => [c.id, c]));
  const byName = new Map<string, CenterDoc>();
  for (const c of centers) {
    const centerAny = c as unknown as AnyObj;
    const variants = [c.name, centerAny.displayName, centerAny.centerName, centerAny.title, centerAny.label]
      .map((v) => str(v))
      .filter(Boolean);
    for (const v of variants) {
      byName.set(v.toLowerCase(), c);
      byName.set(baseCenterMatchKey(v), c);
    }
  }
  return (raw?: unknown) => {
    const key = str(raw).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!key) return { id: '', name: 'Unassigned' };
    const direct = byId.get(key) || byName.get(key.toLowerCase()) || byName.get(baseCenterMatchKey(key));
    return { id: direct?.id || key, name: direct?.name || key };
  };
}

export function saleInvoiceFaceTotal(sale: SaleDoc | AnyObj): number {
  const totalAmount = num((sale as AnyObj).totalAmount);
  const gstAmount = num((sale as AnyObj).gstAmount);
  if (totalAmount || gstAmount) return totalAmount + gstAmount;
  return num((sale as AnyObj).grandTotal);
}

function salePaidAmount(sale: SaleDoc | AnyObj): number {
  const explicit = num((sale as AnyObj).amountPaid ?? (sale as AnyObj).paidAmount);
  if (explicit) return explicit;
  const payments = (sale as AnyObj).payments;
  if (Array.isArray(payments)) {
    return payments.reduce((sum, p) => sum + num((p as AnyObj).amount), 0);
  }
  return 0;
}

function dateLabel(raw: unknown): string {
  const d = toDateSafe(raw);
  return d ? format(d, 'yyyy-MM-dd') : '';
}

function paymentLines(source: AnyObj | undefined | null): NormalizedSaleRow['paymentHistory'] {
  if (!source) return [];
  const pools = [
    ...(Array.isArray(source.payments) ? source.payments : []),
    ...(Array.isArray(source.paymentRecords) ? source.paymentRecords : []),
  ] as AnyObj[];
  return pools
    .map((p) => ({
      amount: num(p.amount ?? p.paidAmount),
      mode: str(p.mode || p.paymentMode || p.paymentMethod || p.paymentType, '—'),
      referenceNumber: str(p.referenceNumber || p.referenceNo || p.utr || p.chequeNumber || p.transactionId),
      remarks: str(p.remarks || p.note || p.notes),
      date: dateLabel(p.paymentDate || p.date || p.paidAt || p.createdAt),
    }))
    .filter((p) => p.amount > 0);
}

function paymentStatus(total: number, paid: number, sale: AnyObj, date: Date | null): SalesPaymentStatus {
  if (sale.cancelled === true || /cancel|void/i.test(str(sale.status))) return 'cancelled';
  const raw = str(sale.paymentStatus || sale.status).toLowerCase();
  if (/overdue/.test(raw)) return 'overdue';
  if (/paid|complete/.test(raw) || (total > 0 && paid >= total - 1)) return 'paid';
  if (paid > 0) return 'partial';
  const due = toDateSafe(sale.dueDate);
  if (due && due.getTime() < Date.now()) return 'overdue';
  if (date && Date.now() - date.getTime() > 30 * 24 * 3600 * 1000 && total > 0) return 'overdue';
  return 'pending';
}

function productLines(raw: AnyObj): AnyObj[] {
  const candidates = [raw.items, raw.products, raw.productLines, getPath(raw, 'hearingAidDetails.products')];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as AnyObj[];
  }
  return [];
}

function discountAgg(lines: AnyObj[], fallbackTotal = 0) {
  let mrp = 0;
  let discount = 0;
  const products: string[] = [];
  for (const line of lines) {
    products.push(str(line.productName || line.name || line.productId, 'Item'));
    const qty = Math.max(1, num(line.quantity ?? line.qty) || 1);
    const unitMrp = num(line.mrp ?? line.mrpPrice ?? line.unitMrp ?? line.hearingAidPrice);
    const lineMrp = num(line.grossMRP) || unitMrp * qty;
    const lineTotal = num(line.amount ?? line.total ?? line.sellingPrice ?? line.rate) * (line.amount ? 1 : qty);
    if (lineMrp > 0) {
      mrp += lineMrp;
      discount += Math.max(lineMrp - (lineTotal || fallbackTotal), 0);
    }
  }
  return { mrp, discount, products };
}

function enquiryCustomer(enquiry: EnquiryDoc) {
  return {
    name: enquiry.customerName || enquiry.name || str((enquiry as unknown as AnyObj).fullName, 'Unknown'),
    phone: enquiry.phone || enquiry.mobile || str((enquiry as unknown as AnyObj).contactNumber),
  };
}

function isSaleVisit(visit: AnyObj): boolean {
  const services = Array.isArray(visit.medicalServices) ? visit.medicalServices.map(String) : [];
  return (
    visit.hearingAidSale === true ||
    visit.purchaseFromTrial === true ||
    str(visit.hearingAidStatus).toLowerCase() === 'sold' ||
    services.some((s) => /hearing_aid_sale|hearing_aid$/.test(s))
  );
}

function isBookingOnlyVisit(visit: AnyObj): boolean {
  const services = Array.isArray(visit.medicalServices) ? visit.medicalServices.map(String) : [];
  return (visit.hearingAidBooked === true || services.includes('hearing_aid_booked')) && !isSaleVisit(visit);
}

function getSalespersonName(raw: AnyObj): string {
  const sp = raw.salesperson;
  if (typeof sp === 'string' && sp.trim()) return sp.trim();
  if (sp && typeof sp === 'object') {
    const name = str((sp as AnyObj).name || (sp as AnyObj).displayName || (sp as AnyObj).label);
    if (name) return name;
  }
  return str(
    raw.salespersonName ||
      raw.staffName ||
      raw.executiveName ||
      raw.soldByName ||
      raw.userName ||
      raw.createdByName ||
      getPath(raw, 'createdBy.name'),
  );
}

function getWhoSoldFromVisit(visit: AnyObj): string {
  return str(
    getPath(visit, 'hearingAidDetails.whoSold') ||
      visit.whoSold ||
      visit.soldBy ||
      visit.soldByName ||
      // CRM currently also uses this legacy field in report normalization.
      visit.hearingAidBrand,
  );
}

function resolveVisitAtIndex(enquiry: EnquiryDoc | undefined, index: unknown): AnyObj {
  if (!enquiry || typeof index !== 'number' || index < 0) return {};
  const visits = Array.isArray(enquiry.visits) ? enquiry.visits : [];
  const v = visits[index];
  if (v && typeof v === 'object') return v as AnyObj;
  const schedules = Array.isArray((enquiry as unknown as AnyObj).visitSchedules)
    ? ((enquiry as unknown as AnyObj).visitSchedules as AnyObj[])
    : [];
  const s = schedules[index];
  return s && typeof s === 'object' ? s : {};
}

function resolveReferenceSource(enquiry: EnquiryDoc | undefined, sale: AnyObj | null): string {
  const enquiryAny = enquiry as unknown as AnyObj | undefined;
  const refs = Array.isArray(enquiryAny?.reference)
    ? enquiryAny?.reference
    : enquiryAny?.reference != null && str(enquiryAny.reference)
      ? [enquiryAny.reference]
      : [];
  const primary = refs.map((x) => str(x)).find(Boolean);
  if (primary) return primary.replace(/_/g, ' ');
  const doctor = str(getPath(sale || {}, 'referenceDoctor.name'));
  if (doctor) return `Doctor: ${doctor}`;
  if (sale && (!sale.enquiryId || sale.source === 'manual')) return 'Direct / manual';
  return 'Unspecified';
}

function visitDate(visit: AnyObj): Date | null {
  return (
    toDateSafe(visit.visitDate) ??
    toDateSafe(visit.date) ??
    toDateSafe(visit.saleDate) ??
    toDateSafe(visit.createdAt)
  );
}

function visitTotal(visit: AnyObj): { total: number; taxable: number; gst: number; paid: number } {
  const details = (visit.hearingAidDetails || {}) as AnyObj;
  const total =
    num(visit.grandTotal) ||
    num(visit.totalAmount) ||
    num(details.grandTotal) ||
    num(details.totalAmount) ||
    num(details.sellingPrice) ||
    num(details.bookingAmount);
  const gst = num(visit.gstAmount ?? details.gstAmount);
  const taxable = num(visit.taxableAmount ?? details.taxableAmount) || Math.max(total - gst, 0);
  const payments = Array.isArray(visit.payments) ? (visit.payments as AnyObj[]) : [];
  const paid = num(visit.amountPaid) || payments.reduce((sum, p) => sum + num(p.amount), 0);
  return { total, taxable, gst, paid };
}

function saleCoversVisit(sale: SaleDoc, enquiryId: string, visitIndex: number, date: Date | null): boolean {
  const s = sale as unknown as AnyObj;
  if (str(s.enquiryId) !== enquiryId) return false;
  if (num(s.enquiryVisitIndex) === visitIndex || num(s.visitIndex) === visitIndex) return true;
  const saleDate = getNormalizedSaleDate(sale);
  return !!date && !!saleDate && format(date, 'yyyy-MM-dd') === format(saleDate, 'yyyy-MM-dd');
}

export function getNormalizedSaleDate(sale: SaleDoc | AnyObj): Date | null {
  const raw = sale as unknown as AnyObj;
  return (
    toDateSafe(raw.invoiceDate) ??
    toDateSafe(raw.saleDate) ??
    toDateSafe(raw.createdAt)
  );
}

export function buildNormalizedSalesRows(
  sales: SaleDoc[],
  enquiries: EnquiryDoc[],
  centers: CenterDoc[],
): NormalizedSaleRow[] {
  const resolveCenter = buildCenterResolver(centers);
  const enquiryById = new Map(enquiries.map((e) => [e.id, e]));
  const rows: NormalizedSaleRow[] = [];

  for (const sale of sales) {
    const raw = sale as unknown as AnyObj;
    if (raw.cancelled === true || /cancel|void/i.test(str(raw.status))) continue;
    const enquiry = sale.enquiryId ? enquiryById.get(sale.enquiryId) : undefined;
    const visit = resolveVisitAtIndex(enquiry, raw.enquiryVisitIndex ?? raw.visitIndex);
    const center = resolveCenter(
      sale.centerId ||
        sale.branch ||
        visit.centerId ||
        visit.center ||
        visit.visitingCenter ||
        enquiry?.centerId ||
        enquiry?.center ||
        enquiry?.visitingCenter,
    );
    const date = getNormalizedSaleDate(sale);
    const total = saleInvoiceFaceTotal(sale);
    const paid = salePaidAmount(sale);
    const gst = num(raw.gstAmount);
    const taxable = num(raw.totalAmount) || Math.max(total - gst, 0);
    const lines = productLines(raw);
    const discount = discountAgg(lines, total);
    rows.push({
      id: `sale-${sale.id}`,
      sourceKind: 'invoice',
      saleId: sale.id,
      enquiryId: sale.enquiryId,
      invoiceNumber: sale.invoiceNumber || sale.id,
      date,
      customerName: str(raw.patientName || sale.customerName || sale.partyName || enquiry?.customerName || enquiry?.name, 'Walk-in customer'),
      phone: sale.customerPhone || enquiry?.phone || enquiry?.mobile || '',
      email: str(raw.email || raw.customerEmail || (enquiry as unknown as AnyObj | undefined)?.email),
      centerId: center.id,
      centerName: center.name,
      executive: getWhoSoldFromVisit(visit) || getSalespersonName(raw) || str(enquiry?.assignedTo || enquiry?.assignedToName || enquiry?.telecallerName, '—'),
      source: resolveReferenceSource(enquiry, raw),
      company: sale.businessCompany || sale.companyName || str(raw.company, 'Unassigned'),
      total,
      taxable,
      gst,
      paid,
      outstanding: Math.max(total - paid, 0),
      status: paymentStatus(total, paid, raw, date),
      discountMrpBasis: discount.mrp,
      discountOffMrp: discount.discount,
      products: discount.products,
      paymentHistory: paymentLines(raw).length ? paymentLines(raw) : paymentLines(enquiry as unknown as AnyObj | undefined),
      raw,
    });
  }

  for (const enquiry of enquiries) {
    const visits = Array.isArray(enquiry.visits) ? enquiry.visits as AnyObj[] : [];
    const customer = enquiryCustomer(enquiry);
    visits.forEach((visit, visitIndex) => {
      if (!isSaleVisit(visit) || isBookingOnlyVisit(visit)) return;
      const date = visitDate(visit);
      if (sales.some((s) => saleCoversVisit(s, enquiry.id, visitIndex, date))) return;
      const center = resolveCenter(visit.centerId || visit.center || visit.visitingCenter || enquiry.centerId || enquiry.center || enquiry.visitingCenter);
      const totals = visitTotal(visit);
      const details = (visit.hearingAidDetails || {}) as AnyObj;
      const lines = productLines({ ...visit, ...details });
      const discount = discountAgg(lines, totals.total);
      rows.push({
        id: `enquiry-${enquiry.id}-${visitIndex}`,
        sourceKind: 'enquiry',
        enquiryId: enquiry.id,
        visitIndex,
        invoiceNumber: `Uninvoiced sale #${visitIndex + 1}`,
        date,
        customerName: customer.name,
        phone: customer.phone,
        email: str((enquiry as unknown as AnyObj).email),
        centerId: center.id,
        centerName: center.name,
        executive: getWhoSoldFromVisit(visit) || str((visit as AnyObj).whoSoldName || enquiry.assignedTo || enquiry.assignedToName || enquiry.telecallerName, '—'),
        source: resolveReferenceSource(enquiry, null),
        company: str(visit.company || details.company || (enquiry as unknown as AnyObj).businessCompany, 'Unassigned'),
        total: totals.total,
        taxable: totals.taxable,
        gst: totals.gst,
        paid: totals.paid,
        outstanding: Math.max(totals.total - totals.paid, 0),
        status: paymentStatus(totals.total, totals.paid, visit, date),
        discountMrpBasis: discount.mrp,
        discountOffMrp: discount.discount,
        products: discount.products,
        paymentHistory: paymentLines(enquiry as unknown as AnyObj),
        raw: visit,
      });
    });
  }

  return rows.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
}

export function summarizeNormalizedSales(rows: NormalizedSaleRow[], range?: DateRange | null): SalesSummary {
  const filtered = range ? rows.filter((r) => r.date && r.date >= range.start && r.date <= range.end) : rows;
  const total = filtered.reduce((sum, r) => sum + r.total, 0);
  const paid = filtered.reduce((sum, r) => sum + r.paid, 0);
  const taxable = filtered.reduce((sum, r) => sum + r.taxable, 0);
  const gst = filtered.reduce((sum, r) => sum + r.gst, 0);
  const mrp = filtered.reduce((sum, r) => sum + r.discountMrpBasis, 0);
  const discount = filtered.reduce((sum, r) => sum + r.discountOffMrp, 0);
  return {
    rows: filtered,
    count: filtered.length,
    total,
    paid,
    outstanding: Math.max(total - paid, 0),
    taxable,
    gst,
    avgDiscountPct: mrp > 0 ? (discount / mrp) * 100 : 0,
  };
}

/** Calendar month chunks: May 1-7, May 8-14, … */
function saleMonthWeekBucket(date: Date): { key: string; label: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const periodStart = Math.floor((day - 1) / 7) * 7 + 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const periodEnd = Math.min(periodStart + 6, lastDay);
  const monthLabel = format(new Date(year, month, 1), 'MMM');
  const label = `${monthLabel} ${periodStart}-${periodEnd}`;
  const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(periodStart).padStart(2, '0')}`;
  return { key, label };
}

export interface GroupedSalesRow {
  name: string;
  invoices: number;
  sales: number;
  paid: number;
  outstanding: number;
  avgDiscountPct: number;
  /** Discount amount (₹) — stacked visually on charts beside net sales. */
  discount: number;
}

export function groupSalesRows(rows: NormalizedSaleRow[], key: 'center' | 'executive' | 'source' | 'week' | 'company'): GroupedSalesRow[] {
  const map = new Map<string, { name: string; invoices: number; sales: number; paid: number; outstanding: number; avgDiscountPct: number; _mrp: number; _disc: number }>();
  for (const row of rows) {
    let bucketKey: string;
    let displayName: string;

    if (key === 'center') {
      displayName = row.centerName;
      bucketKey = displayName;
    } else if (key === 'executive') {
      displayName = row.executive;
      bucketKey = displayName;
    } else if (key === 'source') {
      displayName = row.source;
      bucketKey = displayName;
    } else if (key === 'company') {
      displayName = row.company;
      bucketKey = displayName;
    } else if (row.date) {
      const bucket = saleMonthWeekBucket(row.date);
      bucketKey = bucket.key;
      displayName = bucket.label;
    } else {
      bucketKey = 'no-date';
      displayName = 'No date';
    }

    const entry = map.get(bucketKey) || {
      name: displayName,
      invoices: 0,
      sales: 0,
      paid: 0,
      outstanding: 0,
      avgDiscountPct: 0,
      _mrp: 0,
      _disc: 0,
    };
    entry.invoices += 1;
    entry.sales += row.total;
    entry.paid += row.paid;
    entry.outstanding += row.outstanding;
    entry._mrp += row.discountMrpBasis;
    entry._disc += row.discountOffMrp;
    entry.avgDiscountPct = entry._mrp > 0 ? (entry._disc / entry._mrp) * 100 : 0;
    map.set(bucketKey, entry);
  }

  const toPublic = (v: { name: string; invoices: number; sales: number; paid: number; outstanding: number; avgDiscountPct: number; _mrp: number; _disc: number }): GroupedSalesRow => ({
    name: v.name,
    invoices: v.invoices,
    sales: v.sales,
    paid: v.paid,
    outstanding: v.outstanding,
    avgDiscountPct: v.avgDiscountPct,
    discount: v._disc,
  });

  const entries = Array.from(map.entries());
  if (key === 'week') {
    return entries.sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => toPublic(v));
  }
  return entries.sort(([, a], [, b]) => b.sales - a.sales).map(([, v]) => toPublic(v));
}
