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
