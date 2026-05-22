import { CrmPdfError, fetchCrmPdf } from '@/lib/crm/downloadCrmPdf';

export { CrmPdfError as CrmReceiptPdfError };

export type CrmReceiptType = 'booking' | 'trial';

export type ReceiptRenderPayload = {
  receiptType: CrmReceiptType;
  enquiry: Record<string, unknown>;
  visit: Record<string, unknown>;
  options?: {
    receiptNumber?: string;
    centerName?: string;
    paymentMode?: string;
  };
};

export async function downloadCrmReceiptPdf(payload: ReceiptRenderPayload): Promise<{
  blob: Blob;
  fileName: string;
}> {
  const label = payload.receiptType === 'booking' ? 'booking-receipt' : 'trial-receipt';
  const receiptNo =
    payload.options?.receiptNumber ||
    (payload.receiptType === 'booking'
      ? String(payload.visit.bookingReceiptNumber || '')
      : String(payload.visit.trialReceiptNumber || ''));
  const safe = receiptNo.replace(/[^\w.-]+/g, '-') || 'receipt';

  return fetchCrmPdf({
    apiPath: '/api/receipts/render',
    method: 'POST',
    body: payload,
    fileName: `${label}-${safe}.pdf`,
  });
}
