import type { NormalizedSaleRow } from '@/lib/reports/sales';

type AnyObj = Record<string, unknown>;

/** Shape sale payload the same way CRM Sales & Invoicing passes into `convertSaleToInvoiceData`. */
export function normalizedSaleToInvoicePayload(row: NormalizedSaleRow): AnyObj {
  const raw: AnyObj = { ...(row.raw || {}) };
  const paymentModes = [
    ...new Set(row.paymentHistory.map((p) => p.mode).filter((m) => m && m !== '—')),
  ];

  if (!raw.paymentMethod && paymentModes.length) {
    raw.paymentMethod = paymentModes.join(', ');
  }
  if (!raw.patientName) raw.patientName = row.customerName;
  if (!raw.phone) raw.phone = row.phone;
  if (!raw.email) raw.email = row.email;
  if (!raw.invoiceNumber) raw.invoiceNumber = row.invoiceNumber;
  if (raw.saleDate == null && row.date) {
    raw.saleDate = row.date instanceof Date ? row.date.toISOString() : row.date;
  }
  if (raw.gstAmount == null) raw.gstAmount = row.gst;
  if (raw.totalAmount == null) raw.totalAmount = row.taxable;
  if (raw.grandTotal == null) raw.grandTotal = row.total;

  const ref = raw.referenceDoctor;
  if (!ref && row.source) {
    raw.referenceDoctor = typeof ref === 'object' && ref ? ref : { name: row.source };
  }

  const sp = raw.salesperson;
  if (!sp && row.executive) {
    raw.salesperson = typeof sp === 'object' && sp ? sp : { name: row.executive };
  }

  if (!raw.branch && row.centerName) raw.branch = row.centerName;

  return raw;
}
