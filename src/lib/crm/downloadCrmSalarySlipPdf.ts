import { CrmPdfError, fetchCrmPdf } from '@/lib/crm/downloadCrmPdf';

export { CrmPdfError as CrmSalarySlipPdfError };

export async function downloadCrmSalarySlipPdf(
  staffId: string,
  month: string,
  staffName?: string,
): Promise<{ blob: Blob; fileName: string }> {
  if (!staffId?.trim()) throw new CrmPdfError('Staff id is required.');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new CrmPdfError('Month must be YYYY-MM.');

  const safeName = (staffName || staffId).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

  return fetchCrmPdf({
    apiPath: '/api/staff/salary-slip-pdf',
    method: 'GET',
    query: { staffId: staffId.trim(), month, format: 'pdf' },
    fileName: `salary-slip-${safeName}-${month}.pdf`,
  });
}
