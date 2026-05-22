/**
 * Mirrors CRM `convertSaleToInvoiceData` / HTML invoice pipeline
 * (`hearing-hope-crm/src/utils/invoiceSaleToData.ts`).
 */
import { resolveInvoicePdfGrandTotal } from '@/lib/invoices/saleInvoiceFaceTotal';

export interface InvoiceDataItem {
  id: string;
  name: string;
  description?: string;
  serialNumber?: string;
  quantity: number;
  rate: number;
  mrp?: number;
  discount?: number;
  discountPercent?: number;
  gstPercent?: number;
  amount: number;
  taxLineAmount?: number;
  inclusiveLineAmount?: number;
  hsnCode?: string;
  sellingPrice?: number;
}

export interface InvoiceData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyGST: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  customerGST?: string;
  items: InvoiceDataItem[];
  subtotal: number;
  totalDiscount?: number;
  totalGST?: number;
  grandTotal: number;
  referenceDoctor?: string;
  salesperson?: string;
  branch?: string;
  paymentMethod?: string;
  notes?: string;
  terms?: string;
}

type SaleRecord = Record<string, unknown>;

function normalizeInvoiceNumberString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function isProvisionalInvoiceNumber(invoiceNumber: string): boolean {
  return /^PROV[-_]/i.test(invoiceNumber.trim());
}

export function saleHasBillableInvoiceNumber(inv: unknown): boolean {
  const s = normalizeInvoiceNumberString(inv);
  return s.length > 0 && !isProvisionalInvoiceNumber(s);
}

function formatInvoiceDateLabel(value: unknown): string {
  if (value == null) return new Date().toLocaleDateString('en-IN');
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v?.toDate === 'function') return v.toDate().toLocaleDateString('en-IN');
  if (v?.seconds != null) return new Date(v.seconds * 1000).toLocaleDateString('en-IN');
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString('en-IN') : d.toLocaleDateString('en-IN');
  }
  if (value instanceof Date) return value.toLocaleDateString('en-IN');
  return new Date().toLocaleDateString('en-IN');
}

const getDefaultTermsAndConditions = (): string =>
  `1. Payment is due within 30 days of invoice date.
2. All sales are final unless otherwise specified.
3. Warranty terms apply as per manufacturer guidelines.
4. Please retain this invoice for warranty claims.
5. For any queries, please contact us within 7 days.`;

/** Map raw sale payload into `InvoiceData` for CRM `/api/invoices/render`. */
export function convertSaleToInvoiceData(sale: SaleRecord): InvoiceData {
  const products = (sale.products as SaleRecord[]) || [];
  const accessories = (sale.accessories as SaleRecord[]) || [];

  const lineQty = (p: SaleRecord) => {
    const q = Math.floor(Number(p.quantity) || 1);
    return !Number.isFinite(q) || q < 1 ? 1 : Math.min(9999, q);
  };

  const productSub =
    products.reduce((sum: number, product: SaleRecord) => {
      const unit = Number(product.sellingPrice) || Number(product.finalAmount) || 0;
      return sum + Math.round(unit * lineQty(product));
    }, 0) || 0;

  const accessorySub = accessories.reduce((sum: number, a: SaleRecord) => {
    if (a.isFree) return sum;
    const qty = lineQty(a);
    return sum + Math.round((Number(a.price) || 0) * qty);
  }, 0);

  const subtotal = productSub + accessorySub;
  const totalGST = Math.round(Number(sale.gstAmount) || 0);
  const totalDiscount =
    products.reduce((sum: number, product: SaleRecord) => {
      const mrp = Number(product.mrp) || 0;
      const sellingPrice = Number(product.sellingPrice) || Number(product.finalAmount) || 0;
      const discount = (mrp - sellingPrice) * (Number(product.quantity) || 1);
      return sum + (discount > 0 ? discount : 0);
    }, 0) || 0;

  const computedGrand = Math.round(subtotal + totalGST);
  const grandTotal = resolveInvoicePdfGrandTotal(sale, computedGrand);

  const productRows = products.map((product: SaleRecord, index: number) => {
    const qty = lineQty(product);
    const unitSp = Number(product.sellingPrice) || Number(product.finalAmount) || 0;
    const linePreTax = Math.round(unitSp * qty);
    const gstPct = Number(product.gstPercent) || Number(sale.gstPercentage) || 0;
    const gstExempt = product.gstApplicable === false;
    const unitGst = Number(product.gstAmount);
    const lineGst = gstExempt
      ? 0
      : Number.isFinite(unitGst)
        ? Math.round(unitGst * qty)
        : Math.round((linePreTax * gstPct) / 100);
    const unitFin = Number(product.finalAmount);
    const lineInclusive =
      Number.isFinite(unitFin) && unitFin > 0 ? Math.round(unitFin * qty) : linePreTax + lineGst;
    const typeOrCompany = String(product.type ?? product.company ?? '').trim();
    const warranty = String(product.warranty ?? '').trim();
    const description = warranty
      ? [typeOrCompany, `Warranty: ${warranty}`].filter(Boolean).join(' · ')
      : typeOrCompany;

    return {
      id: (product.id as string) || `item-${index}`,
      name: (product.name as string) || 'Unknown Product',
      description,
      serialNumber: (product.serialNumber as string) || '',
      quantity: qty,
      rate: unitSp,
      mrp: Number(product.mrp) || 0,
      discount: Number(product.discount) || 0,
      discountPercent:
        typeof product.discountPercent === 'number' && !Number.isNaN(product.discountPercent)
          ? product.discountPercent
          : undefined,
      gstPercent: gstPct,
      amount: linePreTax,
      taxLineAmount: lineGst,
      inclusiveLineAmount: lineInclusive,
    };
  });

  const accessoryRows = accessories.map((a: SaleRecord, index: number) => {
    const qty = lineQty(a);
    const rate = a.isFree ? 0 : Number(a.price) || 0;
    const linePreTax = Math.round(rate * qty);
    return {
      id: (a.id as string) || `acc-${index}`,
      name: (a.name as string) || 'Accessory',
      description: 'Accessory',
      serialNumber: '',
      quantity: qty,
      rate,
      mrp: rate,
      discount: 0,
      gstPercent: 0,
      amount: linePreTax,
      taxLineAmount: 0,
      inclusiveLineAmount: linePreTax,
    };
  });

  const items = [...productRows, ...accessoryRows];
  const invoiceNumber = normalizeInvoiceNumberString(sale.invoiceNumber) || '—';
  const invoiceDate = formatInvoiceDateLabel(sale.saleDate);
  const refDoc = sale.referenceDoctor as { name?: string } | undefined;
  const salesDoc = sale.salesperson as { name?: string } | undefined;
  const customerGST =
    (sale.customerGstNumber as string) ||
    (sale.customerGSTIN as string) ||
    (sale.customerGSTNumber as string) ||
    (sale.customerGST as string) ||
    '';

  return {
    companyName: 'Hope Hearing Solutions',
    companyAddress: 'Your Company Address\nCity, State - PIN Code',
    companyPhone: '+91 XXXXX XXXXX',
    companyEmail: 'info@hopehearing.com',
    companyGST: 'GST Number Here',
    invoiceNumber,
    invoiceDate,
    customerName: (sale.patientName as string) || 'Walk-in Customer',
    customerAddress: (sale.address as string) || '',
    customerPhone: (sale.phone as string) || '',
    customerEmail: (sale.email as string) || '',
    customerGST,
    items,
    subtotal,
    totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
    totalGST: totalGST > 0 ? totalGST : undefined,
    grandTotal,
    referenceDoctor: refDoc?.name || (typeof sale.referenceDoctor === 'string' ? sale.referenceDoctor : ''),
    salesperson: salesDoc?.name || (typeof sale.salesperson === 'string' ? sale.salesperson : ''),
    branch: (sale.branch as string) || '',
    paymentMethod: (sale.paymentMethod as string) || '',
    notes: (sale.notes as string) || '',
    terms: getDefaultTermsAndConditions(),
  };
}
