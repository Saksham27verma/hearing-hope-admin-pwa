/** Mirrors CRM `resolveInvoicePdfGrandTotal` for invoice PDF totals. */
export function resolveInvoicePdfGrandTotal(
  sale: {
    totalAmount?: unknown;
    gstAmount?: unknown;
    grandTotal?: unknown;
    exchangeCreditInr?: unknown;
  },
  lineComputedGrand: number,
): number {
  const ex = Math.max(0, Number(sale.exchangeCreditInr) || 0);
  const fromParts = Math.round((Number(sale.totalAmount) || 0) + (Number(sale.gstAmount) || 0));
  const lines = Math.round(lineComputedGrand);

  if (ex > 0) {
    if (fromParts > 0) return fromParts;
    if (lines > 0) return lines;
    const net = Number(sale.grandTotal);
    if (!Number.isNaN(net)) return Math.round(net + ex);
    return 0;
  }

  const stored = sale.grandTotal;
  if (typeof stored === 'number' && !Number.isNaN(stored)) return Math.round(stored);
  if (fromParts > 0) return fromParts;
  return lines;
}
