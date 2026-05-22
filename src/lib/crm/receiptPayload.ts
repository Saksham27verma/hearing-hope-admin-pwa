import type { ReceiptRenderPayload } from '@/lib/crm/downloadCrmReceiptPdf';
import type { EnquiryDoc } from '@/lib/firestore/queries';

type AnyObj = Record<string, unknown>;

function str(v: unknown, fallback = '') {
  if (v === undefined || v === null) return fallback;
  return String(v).trim() || fallback;
}

function getSchedules(enquiry: EnquiryDoc): AnyObj[] {
  if (Array.isArray(enquiry.visitSchedules) && enquiry.visitSchedules.length > 0) {
    return enquiry.visitSchedules as AnyObj[];
  }
  if (Array.isArray(enquiry.visits) && enquiry.visits.length > 0) {
    return enquiry.visits as AnyObj[];
  }
  return [];
}

/** Shape enquiry for CRM `/api/receipts/render` (same fields as CRM patient profile). */
export function enquiryPayloadForCrm(enquiry: EnquiryDoc): Record<string, unknown> {
  const e = enquiry as unknown as AnyObj;
  return {
    ...e,
    id: enquiry.id,
    name: enquiry.name || enquiry.customerName || enquiry.patientName || enquiry.fullName,
    phone: enquiry.phone || enquiry.mobile || e.contactNumber,
    email: enquiry.email || '',
    address: enquiry.address || e.customerAddress || '',
    center: enquiry.center || enquiry.centerId || e.visitingCenter,
    visitingCenter: e.visitingCenter || enquiry.center,
    centerId: enquiry.centerId || e.centerId,
    payments: enquiry.payments || e.payments,
    paymentRecords: enquiry.paymentRecords || e.paymentRecords,
  };
}

export function visitPayloadForCrm(enquiry: EnquiryDoc, visitIndex: number): Record<string, unknown> | null {
  const schedules = getSchedules(enquiry);
  const visit = schedules[visitIndex];
  if (!visit) return null;
  return {
    ...visit,
    id: str(visit.id) || `${enquiry.id}-visit-${visitIndex}`,
  };
}

function bookingPaymentMode(enquiry: EnquiryDoc): string | undefined {
  const pools = [
    ...(Array.isArray(enquiry.payments) ? enquiry.payments : []),
    ...(Array.isArray(enquiry.paymentRecords) ? enquiry.paymentRecords : []),
  ] as AnyObj[];
  const fromPayments = pools.find((p) => str(p.paymentFor).toLowerCase() === 'booking_advance');
  if (fromPayments?.paymentMode) return str(fromPayments.paymentMode);
  const fromRecords = pools.find((p) => str(p.paymentType).toLowerCase() === 'hearing_aid_booking');
  return fromRecords?.paymentMethod ? str(fromRecords.paymentMethod) : undefined;
}

export function bookingReceiptPayload(
  enquiry: EnquiryDoc,
  visitIndex: number,
  centerName?: string,
): ReceiptRenderPayload | null {
  const visit = visitPayloadForCrm(enquiry, visitIndex);
  if (!visit) return null;
  return {
    receiptType: 'booking',
    enquiry: enquiryPayloadForCrm(enquiry),
    visit,
    options: {
      receiptNumber: str(visit.bookingReceiptNumber) || undefined,
      centerName: centerName || undefined,
      paymentMode: bookingPaymentMode(enquiry),
    },
  };
}

export function trialReceiptPayload(
  enquiry: EnquiryDoc,
  visitIndex: number,
  centerName?: string,
): ReceiptRenderPayload | null {
  const visit = visitPayloadForCrm(enquiry, visitIndex);
  if (!visit) return null;
  return {
    receiptType: 'trial',
    enquiry: enquiryPayloadForCrm(enquiry),
    visit,
    options: {
      receiptNumber: str(visit.trialReceiptNumber) || undefined,
      centerName: centerName || undefined,
    },
  };
}

import type { ReceiptRenderPayload } from '@/lib/crm/downloadCrmReceiptPdf';
