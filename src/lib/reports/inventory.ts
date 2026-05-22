import type { CenterDoc } from '@/lib/firestore/queries';
import { buildCenterResolver } from './sales';

type AnyObj = Record<string, unknown>;

export interface InventorySnapshotRow {
  id: string;
  productId: string;
  productName: string;
  category: string;
  company: string;
  centerId: string;
  centerName: string;
  serial?: string;
  available: number;
  sold: number;
  reserved: number;
  staffAssigned: number;
  status: 'In Stock' | 'Sold' | 'Reserved' | 'Staff assign' | 'Out of Stock';
  value: number;
}

function str(v: unknown, fallback = '') {
  if (v === undefined || v === null) return fallback;
  return String(v).trim() || fallback;
}

function normalizeSerial(v: unknown) {
  return str(v)
    .replace(/^['"`\s]+|['"`\s]+$/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function splitSerialCandidates(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(splitSerialCandidates);
  const raw = str(value);
  if (!raw) return [];
  return raw
    .split(/[,;\n\r\t|/]+/)
    .map(normalizeSerial)
    .filter(Boolean);
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function productName(product: AnyObj) {
  return str(product.name || product.productName || product.model || product.id, 'Unknown product');
}

function serialsFromDoc(doc: AnyObj): string[] {
  return Array.from(new Set([
    ...splitSerialCandidates(doc.serialNumbers),
    ...splitSerialCandidates(doc.serials),
    ...splitSerialCandidates(doc.serialNumbersList),
    ...splitSerialCandidates(doc.serialNumber),
    ...splitSerialCandidates(doc.serialNo),
    ...splitSerialCandidates(doc.serial),
    ...splitSerialCandidates(doc.trialSerialNumber),
    ...splitSerialCandidates(doc.deviceSerial),
    ...splitSerialCandidates(doc.hearingAidSerial),
  ]));
}

function itemRows(doc: AnyObj): AnyObj[] {
  if (Array.isArray(doc.items)) return doc.items as AnyObj[];
  if (Array.isArray(doc.products)) return doc.products as AnyObj[];
  return [doc];
}

export function buildInventorySnapshot(
  products: AnyObj[],
  materialInward: AnyObj[],
  purchases: AnyObj[],
  materialsOut: AnyObj[],
  sales: AnyObj[],
  enquiries: AnyObj[],
  staffCustody: AnyObj[],
  centers: CenterDoc[],
): InventorySnapshotRow[] {
  const resolveCenter = buildCenterResolver(centers);
  const productById = new Map(products.map((p) => [str(p.id || p.productId), p]));
  const stock = new Map<string, InventorySnapshotRow>();
  const serialIndex = new Map<string, InventorySnapshotRow>(); // one physical serial can only exist once.

  const ensure = (productId: string, location: unknown, serial?: string) => {
    const p = productById.get(productId) || {};
    const c = resolveCenter(location);
    const normalizedSerial = serial ? normalizeSerial(serial) : '';
    if (normalizedSerial) {
      const existingSerialRow = serialIndex.get(normalizedSerial);
      if (existingSerialRow) {
        // Duplicate incoming docs should move/update the same serial, not add stock.
        existingSerialRow.centerId = c.id;
        existingSerialRow.centerName = c.name;
        existingSerialRow.company = str(p.company || p.manufacturer || p.businessCompany, existingSerialRow.company);
        return existingSerialRow;
      }
    }
    const key = `${productId}|${c.id}|${normalizedSerial || 'qty'}`;
    const existing = stock.get(key);
    if (existing) return existing;
    const row: InventorySnapshotRow = {
      id: key,
      productId,
      productName: productName(p),
      category: str(p.type || p.category || p.quantityType, 'General'),
      company: str(p.company || p.manufacturer || p.businessCompany, 'Unassigned'),
      centerId: c.id,
      centerName: c.name,
      serial: normalizedSerial || undefined,
      available: 0,
      sold: 0,
      reserved: 0,
      staffAssigned: 0,
      status: 'Out of Stock',
      value: 0,
    };
    stock.set(key, row);
    if (normalizedSerial) serialIndex.set(normalizedSerial, row);
    return row;
  };

  const findSerialRow = (serial: string) => serialIndex.get(normalizeSerial(serial));

  const findQtyRow = (productId: string, location: unknown) => {
    const wanted = resolveCenter(location).id;
    return (
      Array.from(stock.values()).find(
        (row) => row.productId === productId && !row.serial && row.centerId === wanted && row.available > 0,
      ) ||
      Array.from(stock.values()).find((row) => row.productId === productId && !row.serial && row.available > 0)
    );
  };

  const addIncoming = (doc: AnyObj) => {
    for (const item of itemRows(doc)) {
      const productId = str(item.productId || doc.productId || item.id);
      if (!productId) continue;
      const serials = serialsFromDoc(item).length ? serialsFromDoc(item) : serialsFromDoc(doc);
      const qty = Math.max(1, num(item.quantity || doc.quantity) || (serials.length || 1));
      const location = item.location || doc.location || doc.centerId || doc.branch;
      const price = num(item.dealerPrice || item.purchasePrice || item.costPrice || doc.dealerPrice || doc.purchasePrice);
      if (serials.length) {
        for (const serial of serials) {
          const row = ensure(productId, location, serial);
          row.available = Math.max(row.available, 1);
          row.value += price;
        }
      } else {
        const row = ensure(productId, location);
        row.available += qty;
        row.value += price * qty;
      }
    }
  };

  materialInward.forEach(addIncoming);
  purchases.forEach(addIncoming);

  for (const doc of materialsOut) {
    if (/returned/i.test(str(doc.status))) continue;
    for (const item of itemRows(doc)) {
      const productId = str(item.productId || doc.productId || item.id);
      if (!productId) continue;
      const serials = serialsFromDoc(item).length ? serialsFromDoc(item) : serialsFromDoc(doc);
      const qty = Math.max(1, num(item.quantity || doc.quantity) || (serials.length || 1));
      const location = item.location || doc.location || doc.centerId || doc.branch;
      if (serials.length) {
        serials.forEach((serial) => {
          const row = findSerialRow(serial);
          if (!row) return;
          row.available = Math.max(row.available - 1, 0);
          row.reserved += /pending|reserve/i.test(str(doc.status)) ? 1 : 0;
        });
      } else {
        const row = findQtyRow(productId, location) ?? ensure(productId, location);
        row.available = Math.max(row.available - qty, 0);
        if (/pending|reserve/i.test(str(doc.status))) row.reserved += qty;
      }
    }
  }

  for (const sale of sales) {
    if (sale.cancelled === true || /cancel|void/i.test(str(sale.status))) continue;
    for (const item of itemRows(sale)) {
      const productId = str(item.productId || item.id);
      const serials = serialsFromDoc(item);
      const qty = Math.max(1, num(item.quantity) || (serials.length || 1));
      const location = sale.centerId || sale.branch || item.location;
      if (serials.length) {
        serials.forEach((serial) => {
          const row = findSerialRow(serial);
          if (!row) return;
          row.available = Math.max(row.available - 1, 0);
          row.sold += 1;
        });
      } else {
        if (!productId) continue;
        const row = findQtyRow(productId, location) ?? ensure(productId, location);
        row.available = Math.max(row.available - qty, 0);
        row.sold += qty;
      }
    }
  }

  for (const enquiry of enquiries) {
    const visits = Array.isArray(enquiry.visits) ? enquiry.visits as AnyObj[] : [];
    for (const visit of visits) {
      const medicalServices = Array.isArray(visit.medicalServices)
        ? visit.medicalServices.map((x) => String(x).toLowerCase())
        : [];
      const isSale = !!(
        visit.hearingAidSale ||
        visit.purchaseFromTrial ||
        str(visit.hearingAidStatus).toLowerCase() === 'sold' ||
        str((visit.hearingAidDetails as AnyObj | undefined)?.hearingAidStatus).toLowerCase() === 'sold' ||
        medicalServices.includes('hearing_aid_sale') ||
        medicalServices.includes('hearing_aid')
      );
      if (!isSale) continue;
      const products = Array.isArray(visit.products)
        ? visit.products as AnyObj[]
        : Array.isArray((visit.hearingAidDetails as AnyObj | undefined)?.products)
          ? (visit.hearingAidDetails as AnyObj).products as AnyObj[]
          : [visit, (visit.hearingAidDetails || {}) as AnyObj];
      for (const prod of products) {
        const productId = str(prod.productId || prod.id || prod.hearingAidProductId || visit.hearingAidProductId || (visit.hearingAidDetails as AnyObj | undefined)?.hearingAidProductId);
        const serials = Array.from(new Set([...serialsFromDoc(prod), ...serialsFromDoc(visit), ...serialsFromDoc((visit.hearingAidDetails || {}) as AnyObj)]));
        const qty = Math.max(1, num(prod.quantity || prod.qty || visit.quantity) || (serials.length || 1));
        const location = visit.centerId || visit.center || visit.visitingCenter || enquiry.centerId || enquiry.center || enquiry.visitingCenter;
        if (serials.length) {
          serials.forEach((serial) => {
            const row = findSerialRow(serial);
            if (!row) return;
            row.available = Math.max(row.available - 1, 0);
            row.sold += 1;
          });
        } else if (productId) {
          const row = findQtyRow(productId, location) ?? ensure(productId, location);
          row.available = Math.max(row.available - qty, 0);
          row.sold += qty;
        }
      }
    }
  }

  for (const custody of staffCustody) {
    const custodyProduct = (custody.product || {}) as AnyObj;
    const productId = str(custody.productId || custodyProduct.id);
    if (!productId) continue;
    const serial = str(custody.serialNumber || custody.serial);
    const row = serial
      ? findSerialRow(serial)
      : findQtyRow(productId, custody.centerId || custody.location) ?? ensure(productId, custody.centerId || custody.location);
    if (!row) continue;
    row.available = Math.max(row.available - 1, 0);
    row.staffAssigned += 1;
  }

  return Array.from(stock.values()).map((row) => ({
    ...row,
    status: row.sold > 0 && row.available === 0
      ? 'Sold'
      : row.staffAssigned > 0
        ? 'Staff assign'
        : row.reserved > 0
          ? 'Reserved'
          : row.available <= 0
            ? 'Out of Stock'
            : 'In Stock',
  }));
}
