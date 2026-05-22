import { CrmPdfError, fetchCrmPdf, triggerPdfDownload } from '@/lib/crm/downloadCrmPdf';
import type { InvoiceData } from '@/lib/invoices/convertSaleToInvoiceData';
import { saleHasBillableInvoiceNumber } from '@/lib/invoices/convertSaleToInvoiceData';

export class CrmInvoicePdfError extends CrmPdfError {}

function friendlyRenderError(message: string): string {
  if (/invoice HTML template is required/i.test(message)) {
    return `${message} — Configure an invoice HTML template in CRM Invoice Manager.`;
  }
  return message;
}

/**
 * Downloads the same PDF the live CRM generates via POST `/api/invoices/render`.
 */
export async function downloadCrmInvoicePdf(
  invoiceData: InvoiceData,
  options?: { templateId?: string | null },
): Promise<{ blob: Blob; fileName: string }> {
  if (!saleHasBillableInvoiceNumber(invoiceData.invoiceNumber)) {
    throw new CrmInvoicePdfError(
      'Only saved invoices with a valid assigned invoice number can be downloaded.',
    );
  }

  try {
    const safe = `invoice-${String(invoiceData.invoiceNumber || 'INV').replace(/[^\w.-]+/g, '-')}.pdf`;
    return await fetchCrmPdf({
      apiPath: '/api/invoices/render',
      method: 'POST',
      body: { invoiceData, templateId: options?.templateId || undefined },
      fileName: safe,
    });
  } catch (err) {
    const msg = err instanceof CrmPdfError ? err.message : 'Failed to render invoice PDF';
    throw new CrmInvoicePdfError(friendlyRenderError(msg), err instanceof CrmPdfError ? err.status : 0);
  }
}

export { triggerPdfDownload };
