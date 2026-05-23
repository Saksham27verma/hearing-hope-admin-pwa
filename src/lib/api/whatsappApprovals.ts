import { adminFetch } from '@/lib/api/adminApi';

export async function approveWhatsAppInvoiceRequest(requestId: string) {
  return adminFetch<{ ok: boolean; error?: string; waStatus?: string }>(
    `/api/whatsapp-invoice-approvals/${encodeURIComponent(requestId)}/approve`,
    { method: 'POST' },
  );
}

export async function rejectWhatsAppInvoiceRequest(requestId: string, reason?: string) {
  return adminFetch<{ ok: boolean; error?: string; waStatus?: string }>(
    `/api/whatsapp-invoice-approvals/${encodeURIComponent(requestId)}/reject`,
    { method: 'POST', body: { reason: reason || undefined } },
  );
}

export async function refreshWhatsAppApprovalPreviewPdf(requestId: string) {
  return adminFetch<{ ok: boolean; error?: string; pdfUrl?: string }>(
    `/api/whatsapp-invoice-approvals/${encodeURIComponent(requestId)}/refresh-pdf`,
    { method: 'POST' },
  );
}
