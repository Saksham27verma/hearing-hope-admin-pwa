'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getAllowedCenterIds,
  isSuperAdminViewer,
  normalizeCenterIdsFromProfile,
} from '@/lib/tenant/centerScope';

const STORAGE_KEY = 'hope-admin-center-scope';

export interface UseCenterScopeValue {
  /** null = global / "All Centers". Otherwise a center id string. */
  effectiveCenterId: string | null;
  setEffectiveCenterId: (id: string | null) => void;
  /** All centers the viewer may select between. null = unrestricted (super-admin). */
  allowedCenterIds: string[] | null;
  /** True for super-admin (can toggle global vs single center). */
  canSelectGlobal: boolean;
  /** True if the account is locked to exactly one center (no switcher). */
  lockedCenterId: string | null;
}

export function useCenterScope(): UseCenterScopeValue {
  const { userProfile } = useAuth();

  const allowed = useMemo(() => getAllowedCenterIds(userProfile), [userProfile]);
  const canGlobal = useMemo(() => isSuperAdminViewer(userProfile), [userProfile]);
  const lockedCenterId = useMemo(() => {
    if (canGlobal) return null;
    const ids = normalizeCenterIdsFromProfile(userProfile);
    return ids.length === 1 ? ids[0] : null;
  }, [userProfile, canGlobal]);

  const [effective, setEffective] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY) || null;
  });

  useEffect(() => {
    if (lockedCenterId) {
      setEffective(lockedCenterId);
      return;
    }
    if (allowed && allowed.length > 0 && effective && !allowed.includes(effective)) {
      setEffective(allowed[0]);
    }
  }, [lockedCenterId, allowed, effective]);

  const setEffectiveCenterId = (id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
    setEffective(id);
  };

  return {
    effectiveCenterId: effective,
    setEffectiveCenterId,
    allowedCenterIds: allowed,
    canSelectGlobal: canGlobal,
    lockedCenterId,
  };
}
