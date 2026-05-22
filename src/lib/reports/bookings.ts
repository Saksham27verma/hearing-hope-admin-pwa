import type { CenterDoc, EnquiryDoc } from '@/lib/firestore/queries';
import { buildCenterResolver } from './sales';
import { toDateSafe } from '@/lib/utils/dateRanges';

type AnyObj = Record<string, unknown>;

export interface BookedRow {
  id: string;
  enquiryId: string;
  visitIndex: number;
  customerName: string;
  phone: string;
  email: string;
  assignedTo: string;
  centerId: string;
  centerName: string;
  bookingDate: Date | null;
  advancePaidDate: Date | null;
  advancePaidDateLabel: string;
  brand: string;
  model: string;
  brandModel: string;
  quantity: number;
  unitMrp: number;
  unitSelling: number;
  totalMrp: number;
  bookingTotal: number;
  advance: number;
  discount: number;
  discountPct: number;
  lineMrp: number;
  lineDiscountRupee: number;
  status: string;
}

export interface TrialRow {
  id: string;
  enquiryId: string;
  visitIndex: number;
  customerName: string;
  phone: string;
  centerId: string;
  centerName: string;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  brand: string;
  model: string;
  brandModel: string;
  status: string;
}

function str(v: unknown, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  return String(v).trim() || fallback;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function services(visit: AnyObj): string[] {
  return Array.isArray(visit.medicalServices) ? visit.medicalServices.map((x) => String(x).toLowerCase()) : [];
}

function normalize(v: unknown): string {
  return str(v).toLowerCase();
}

function hearingAidDetails(visit: AnyObj): AnyObj {
  return visit.hearingAidDetails && typeof visit.hearingAidDetails === 'object' ? (visit.hearingAidDetails as AnyObj) : {};
}

function expandedVisit(visit: AnyObj): AnyObj {
  const details = hearingAidDetails(visit);
  const s = services(visit);
  return {
    ...visit,
    hearingAidSale: Boolean(visit.hearingAidSale) || s.includes('hearing_aid_sale') || s.includes('hearing_aid'),
    hearingAidBooked: Boolean(visit.hearingAidBooked) || s.includes('hearing_aid_booked'),
    hearingAidTrial: Boolean(visit.hearingAidTrial) || s.includes('hearing_aid_trial'),
    hearingTest: Boolean(visit.hearingTest) || s.includes('hearing_test'),
    entService: Boolean(visit.entService) || s.includes('ent_service'),
    purchaseFromTrial: Boolean(visit.purchaseFromTrial) || Boolean(details.purchaseFromTrial),
    trialGiven: Boolean(visit.trialGiven) || Boolean(details.trialGiven),
    bookingFromTrial: Boolean(visit.bookingFromTrial) || Boolean(details.bookingFromTrial),
    bookingAdvanceAmount: num(visit.bookingAdvanceAmount ?? details.bookingAdvanceAmount),
    hearingAidStatus: visit.hearingAidStatus || details.hearingAidStatus || '',
    trialResult: visit.trialResult || details.trialResult || '',
  };
}

function isSaleVisit(visit: AnyObj): boolean {
  const v = expandedVisit(visit);
  return v.hearingAidSale === true || v.purchaseFromTrial === true || normalize(v.hearingAidStatus) === 'sold';
}

function isBookingVisit(visit: AnyObj): boolean {
  const s = services(visit);
  return (visit.hearingAidBooked === true || s.includes('hearing_aid_booked')) && !isSaleVisit(visit);
}

function getSchedules(enquiry: EnquiryDoc): AnyObj[] {
  if (Array.isArray(enquiry.visitSchedules) && enquiry.visitSchedules.length > 0) return enquiry.visitSchedules as AnyObj[];
  if (Array.isArray(enquiry.visits) && enquiry.visits.length > 0) return enquiry.visits as AnyObj[];
  return [];
}

const RANK = {
  inProcess: 20,
  inTrial: 35,
  booked: 45,
  sold: 55,
  notInterested: 60,
} as const;

function isTrialOnlyVisit(visit: AnyObj): boolean {
  const v = expandedVisit(visit);
  return Boolean(v.hearingAidTrial) && !v.hearingAidBooked && !v.bookingFromTrial;
}

function deriveVisitRank(visit: AnyObj): number {
  const v = expandedVisit(visit);
  if (normalize(v.hearingAidStatus) === 'not_interested' || normalize(v.trialResult) === 'unsuccessful') {
    return RANK.notInterested;
  }
  if (Boolean(v.hearingAidSale) || Boolean(v.purchaseFromTrial) || normalize(v.hearingAidStatus) === 'sold') {
    return RANK.sold;
  }
  const trialOnly = isTrialOnlyVisit(v);
  if (Boolean(v.hearingAidBooked) || normalize(v.hearingAidStatus) === 'booked' || (!trialOnly && num(v.bookingAdvanceAmount) > 0)) {
    return RANK.booked;
  }
  const trialResultMeansActive = ['ongoing', 'extended'].includes(normalize(v.trialResult)) && (Boolean(v.hearingAidTrial) || Boolean(v.trialGiven));
  if (
    Boolean(v.hearingAidTrial) ||
    Boolean(v.trialGiven) ||
    ['trial_given', 'trial_completed', 'trial_extended'].includes(normalize(v.hearingAidStatus)) ||
    trialResultMeansActive
  ) {
    return RANK.inTrial;
  }
  return RANK.inProcess;
}

function journeyStatusKey(enquiry: EnquiryDoc): 'in_process' | 'booked' | 'sold' | 'not_interested' {
  const override = normalize((enquiry as unknown as AnyObj).journeyStatusOverride);
  if (override === 'completed') return 'sold';
  if (override === 'sold' || override === 'not_interested') return override;
  if (override === 'booked') return 'booked';

  const schedules = getSchedules(enquiry);
  let maxRank = -1;
  for (const visit of schedules) {
    const cancelled = normalize(visit.visitStatus) === 'cancelled' || normalize(visit.status) === 'cancelled';
    const rank = deriveVisitRank(visit);
    if (cancelled && rank < RANK.booked) continue;
    if (rank > maxRank) maxRank = rank;
  }
  if (maxRank >= RANK.notInterested) return 'not_interested';
  if (maxRank >= RANK.sold) return 'sold';
  if (maxRank >= RANK.booked) return 'booked';
  return 'in_process';
}

function isLiveBookedEnquiry(enquiry: EnquiryDoc): boolean {
  const status = normalize(enquiry.status);
  if (status === 'inactive') return false;
  const journey = journeyStatusKey(enquiry);
  if (journey === 'sold' || journey === 'not_interested') return false;
  return latestBookingVisit(enquiry) != null;
}

function visitSortDate(visit: AnyObj): Date | null {
  return (
    toDateSafe(visit.visitDate) ??
    toDateSafe(visit.date) ??
    toDateSafe(visit.bookingDate) ??
    toDateSafe(visit.trialStartDate) ??
    toDateSafe(visit.createdAt)
  );
}

function latestBookingVisit(enquiry: EnquiryDoc): { visit: AnyObj; index: number } | null {
  const schedules = getSchedules(enquiry);
  return schedules
    .map((visit, index) => ({ visit, index }))
    .filter(({ visit }) => isBookingVisit(visit))
    .sort((a, b) => (visitSortDate(b.visit)?.getTime() || 0) - (visitSortDate(a.visit)?.getTime() || 0))[0] || null;
}

function isTrialVisit(visit: AnyObj): boolean {
  const v = expandedVisit(visit);
  return (
    deriveVisitRank(visit) === RANK.inTrial ||
    isTrialOnlyVisit(visit) ||
    Boolean(v.hearingAidTrial) ||
    Boolean(v.trialGiven)
  );
}

function latestTrialVisit(enquiry: EnquiryDoc): { visit: AnyObj; index: number } | null {
  const schedules = getSchedules(enquiry);
  return (
    schedules
      .map((visit, index) => ({ visit, index }))
      .filter(({ visit }) => isTrialVisit(visit))
      .sort((a, b) => (visitSortDate(b.visit)?.getTime() || 0) - (visitSortDate(a.visit)?.getTime() || 0))[0] || null
  );
}

function isLiveTrialEnquiry(enquiry: EnquiryDoc): boolean {
  const status = normalize(enquiry.status);
  if (status === 'inactive') return false;
  const journey = journeyStatusKey(enquiry);
  if (journey === 'sold' || journey === 'not_interested' || journey === 'booked') return false;
  return latestTrialVisit(enquiry) != null;
}

function trialDeviceLabel(visit: AnyObj): { brand: string; model: string; brandModel: string } {
  const details = hearingAidDetails(visit);
  const brand = str(visit.trialHearingAidBrand || visit.hearingAidBrand || details.whoSold, '—');
  const model = str(visit.trialHearingAidModel || visit.hearingAidModel || details.quotation, '—');
  return { brand, model, brandModel: `${brand} ${model}`.trim() || '—' };
}

function hearingAidLineQty(line: AnyObj): number {
  const q = Math.floor(num(line.quantity));
  if (!Number.isFinite(q) || q < 1) return 1;
  return Math.min(9999, q);
}

function productLines(visit: AnyObj, details: AnyObj): AnyObj[] {
  if (Array.isArray(visit.products)) return visit.products as AnyObj[];
  if (Array.isArray(details.products)) return details.products as AnyObj[];
  return [];
}

function bookingQuantity(visit: AnyObj): number {
  const details = (visit.hearingAidDetails || {}) as AnyObj;
  const explicitCandidates = [
    Math.floor(num(visit.bookingQuantity)),
    Math.floor(num(details.bookingQuantity)),
  ].filter((n) => Number.isFinite(n) && n >= 1);
  const explicitQty = explicitCandidates.length ? Math.max(...explicitCandidates) : 0;
  const productQty = productLines(visit, details).reduce((sum, p) => sum + hearingAidLineQty(p), 0);
  if (explicitQty >= 1 && productQty >= 1) return Math.max(explicitQty, productQty);
  if (explicitQty >= 1) return explicitQty;
  if (productQty >= 1) return productQty;
  return 1;
}

function bookingCommercials(visit: AnyObj) {
  const details = (visit.hearingAidDetails || {}) as AnyObj;
  const qty = bookingQuantity(visit);
  const products = productLines(visit, details);
  const first = products[0] || {};
  const unitSelling = num(visit.bookingSellingPrice) || num(details.bookingSellingPrice);
  const bookingTotal = unitSelling > 0 ? unitSelling * qty : 0;
  const unitMrp =
    num(visit.hearingAidPrice) ||
    num(details.bookingAmount) ||
    num(first.mrp) ||
    num(visit.bookingMRP) ||
    num(details.bookingMRP) ||
    (num(details.grossMRP) > 0 ? num(details.grossMRP) / qty : 0);
  const totalMrp = Math.max(unitMrp * qty, num(details.grossMRP));
  const discount = unitMrp > 0 && bookingTotal > 0 ? Math.max(totalMrp - bookingTotal, 0) : unitMrp > 0 ? Math.max(0, unitMrp - unitSelling) * qty : 0;
  const model = str(visit.hearingAidModel || details.quotation || first.name || first.productName, '—');
  const brand = str(visit.hearingAidBrand || details.whoSold || first.company || first.brand, '—');
  const advance = num(visit.bookingAdvanceAmount ?? details.bookingAdvanceAmount);
  return { qty, bookingTotal, unitMrp, unitSelling, totalMrp, discount, brand, model, brandModel: `${brand} ${model}`.trim(), advance };
}

function localDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizePaymentDateOnly(raw: unknown): string {
  if (raw == null) return '';
  const ts = raw as { toDate?: () => Date; seconds?: number };
  if (typeof ts?.toDate === 'function') {
    const d = ts.toDate();
    if (d && Number.isFinite(d.getTime())) return localDateKey(d);
  }
  if (typeof ts?.seconds === 'number') return localDateKey(new Date(ts.seconds * 1000));
  const value = str(raw);
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isFinite(d.getTime())) return localDateKey(d);
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function isBookingAdvancePayment(payment: AnyObj): boolean {
  const paymentFor = str(payment.paymentFor).toLowerCase();
  const paymentType = str(payment.paymentType).toLowerCase();
  return paymentFor === 'booking_advance' || paymentFor === 'hearing_aid_booking' || paymentType === 'hearing_aid_booking';
}

function advancePaidDate(enquiry: EnquiryDoc, visit: AnyObj, advance: number): { date: Date | null; label: string } {
  if (advance <= 0) return { date: null, label: '—' };
  const visitId = str(visit.id);
  const pools = [
    ...(Array.isArray(enquiry.payments) ? enquiry.payments : []),
    ...(Array.isArray(enquiry.paymentRecords) ? enquiry.paymentRecords : []),
  ] as AnyObj[];
  let candidates = pools.filter((p) => isBookingAdvancePayment(p) && visitId && str(p.relatedVisitId) === visitId);
  if (!candidates.length) {
    candidates = pools.filter((p) => isBookingAdvancePayment(p) && Math.abs(num(p.amount) - advance) < 0.5);
  }
  if (candidates.length) {
    const key = candidates.map((p) => normalizePaymentDateOnly(p.paymentDate)).filter(Boolean).sort()[0];
    if (key) return { date: toDateSafe(key), label: key };
  }
  const fallback = normalizePaymentDateOnly(visit.visitDate || visit.date || visit.bookingDate || (visit.hearingAidDetails as AnyObj | undefined)?.bookingDate);
  return { date: fallback ? toDateSafe(fallback) : null, label: fallback || '—' };
}

export function buildBookedRows(enquiries: EnquiryDoc[], centers: CenterDoc[]): BookedRow[] {
  const resolveCenter = buildCenterResolver(centers);
  return enquiries.flatMap((enquiry) => {
    if (!isLiveBookedEnquiry(enquiry)) return [];
    const latest = latestBookingVisit(enquiry);
    if (!latest) return [];
    const { visit, index: visitIndex } = latest;
    const c = resolveCenter(enquiry.center || enquiry.centerId || visit.centerId || visit.center || visit.visitingCenter || enquiry.visitingCenter);
    const comm = bookingCommercials(visit);
    const advance = advancePaidDate(enquiry, visit, comm.advance);
    return [{
      id: enquiry.id,
      enquiryId: enquiry.id,
      visitIndex,
      customerName: enquiry.customerName || enquiry.name || enquiry.patientName || enquiry.fullName || '—',
      phone: enquiry.phone || enquiry.mobile || str((enquiry as unknown as AnyObj).contactNumber),
      email: enquiry.email || '',
      assignedTo: enquiry.assignedTo || enquiry.assignedToName || enquiry.telecallerName || '',
      centerId: c.id,
      centerName: c.name,
      bookingDate: visitSortDate(visit),
      advancePaidDate: advance.date,
      advancePaidDateLabel: advance.label,
      brand: comm.brand,
      model: comm.model,
      brandModel: comm.brandModel,
      quantity: comm.qty,
      unitMrp: comm.unitMrp,
      unitSelling: comm.unitSelling,
      totalMrp: comm.totalMrp,
      bookingTotal: comm.bookingTotal,
      advance: comm.advance,
      discount: comm.discount,
      discountPct: comm.totalMrp > 0 ? (comm.discount / comm.totalMrp) * 100 : 0,
      lineMrp: comm.totalMrp,
      lineDiscountRupee: comm.discount,
      status: enquiry.status || 'Booked',
    }];
  }).sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export function buildTrialRows(enquiries: EnquiryDoc[], centers: CenterDoc[]): TrialRow[] {
  const resolveCenter = buildCenterResolver(centers);
  return enquiries.flatMap((enquiry) => {
    if (!isLiveTrialEnquiry(enquiry)) return [];
    const latest = latestTrialVisit(enquiry);
    if (!latest) return [];
    const { visit, index: visitIndex } = latest;
    const c = resolveCenter(enquiry.center || enquiry.centerId || visit.centerId || visit.center || visit.visitingCenter || enquiry.visitingCenter);
    const device = trialDeviceLabel(visit);
    return [{
      id: `${enquiry.id}-trial-${visitIndex}`,
      enquiryId: enquiry.id,
      visitIndex,
      customerName: enquiry.customerName || enquiry.name || enquiry.patientName || enquiry.fullName || '—',
      phone: enquiry.phone || enquiry.mobile || str((enquiry as unknown as AnyObj).contactNumber),
      centerId: c.id,
      centerName: c.name,
      trialStartDate: toDateSafe(visit.trialStartDate || visit.visitDate || visit.date),
      trialEndDate: toDateSafe(visit.trialEndDate),
      brand: device.brand,
      model: device.model,
      brandModel: device.brandModel,
      status: enquiry.status || 'In trial',
    }];
  }).sort((a, b) => a.customerName.localeCompare(b.customerName));
}
