/**
 * Multi-tenant (multi-center) scope helpers — copied from the CRM with light
 * trimming. Used by the admin PWA to filter `enquiries`, `sales`,
 * `appointments`, etc. so that a center-locked admin only sees their data.
 */

import type { UserProfile } from '@/context/AuthContext';

export function normalizeCenterIdsFromProfile(
  profile: Pick<UserProfile, 'centerId' | 'branchId' | 'centerIds'> | null,
): string[] {
  if (!profile) return [];
  const raw = profile.centerIds;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];
  }
  const single = profile.centerId ?? profile.branchId;
  if (single !== undefined && single !== null && String(single).trim() !== '') {
    return [String(single).trim()];
  }
  return [];
}

export function isSuperAdminViewer(profile: UserProfile | null): boolean {
  if (!profile || String(profile.role ?? '').toLowerCase().trim() !== 'admin') return false;
  if (profile.isSuperAdmin === true) return true;
  if (profile.isSuperAdmin === false) return false;
  return normalizeCenterIdsFromProfile(profile).length === 0;
}

export function getAllowedCenterIds(profile: UserProfile | null): string[] | null {
  if (!profile) return null;
  if (profile.role === 'admin' && isSuperAdminViewer(profile)) return null;
  const ids = normalizeCenterIdsFromProfile(profile);
  return ids.length > 0 ? ids : null;
}

export type DataScopeMode =
  | { type: 'global' }
  | { type: 'single'; centerId: string }
  | { type: 'union'; centerIds: string[] };

export function resolveDataScope(
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null,
): DataScopeMode {
  if (viewerAllowedCenterIds === null) {
    if (!effectiveScopeCenterId) return { type: 'global' };
    return { type: 'single', centerId: effectiveScopeCenterId };
  }
  if (viewerAllowedCenterIds.length === 0) {
    if (!effectiveScopeCenterId) return { type: 'global' };
    return { type: 'single', centerId: effectiveScopeCenterId };
  }
  if (viewerAllowedCenterIds.length === 1) {
    return { type: 'single', centerId: viewerAllowedCenterIds[0] };
  }
  if (!effectiveScopeCenterId) {
    return { type: 'union', centerIds: viewerAllowedCenterIds };
  }
  return { type: 'single', centerId: effectiveScopeCenterId };
}

function pushIf(out: string[], v: unknown) {
  if (v !== undefined && v !== null && String(v).trim() !== '') out.push(String(v));
}

export function saleMatchesDataScope(
  sale: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const cid = sale.centerId ?? sale.branch;
  if (cid === undefined || cid === null || String(cid).trim() === '') return true;
  if (mode.type === 'union') return mode.centerIds.includes(String(cid));
  return String(cid) === mode.centerId;
}

export function appointmentMatchesDataScope(
  appt: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const cid = appt.centerId;
  if (cid === undefined || cid === null || String(cid).trim() === '') return true;
  if (mode.type === 'union') return mode.centerIds.includes(String(cid));
  return String(cid) === mode.centerId;
}

export function enquiryMatchesDataScope(
  enquiry: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const candidates: string[] = [];
  pushIf(candidates, enquiry.center);
  pushIf(candidates, enquiry.visitingCenter);
  const visits = Array.isArray(enquiry.visits) ? enquiry.visits : [];
  for (const v of visits as Record<string, unknown>[]) {
    pushIf(candidates, v.center);
    pushIf(candidates, v.visitingCenter);
  }
  if (candidates.length === 0) return true;
  if (mode.type === 'union') return candidates.some((c) => mode.centerIds.includes(c));
  return candidates.includes(mode.centerId);
}

export function activityLogMatchesDataScope(
  row: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const cid = row.centerId;
  if (cid === undefined || cid === null || String(cid).trim() === '') return true;
  if (mode.type === 'union') return mode.centerIds.includes(String(cid));
  return String(cid) === mode.centerId;
}

export function inventoryItemMatchesDataScope(
  location: string,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const loc = String(location || '');
  if (!loc) return true;
  if (mode.type === 'union') return mode.centerIds.includes(loc);
  return loc === mode.centerId;
}
