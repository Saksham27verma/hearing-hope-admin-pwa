/**
 * Helpers for calling the CRM's privileged admin API routes from the Admin PWA.
 *
 * The CRM exposes `/api/admin/*` and `/api/profit/summary` etc. behind
 * Firebase ID-token bearer auth (Admin SDK). These helpers attach the token
 * and resolve the configured base URL.
 */

import { auth } from '@/firebase/config';

const CRM_BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE_URL || '').replace(/\/$/, '');

export class AdminApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function getIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const u = auth?.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken();
  } catch {
    return null;
  }
}

export interface AdminFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

export async function adminFetch<T = unknown>(
  path: string,
  opts: AdminFetchOptions = {},
): Promise<T> {
  if (!CRM_BASE) {
    throw new AdminApiError(
      'NEXT_PUBLIC_CRM_API_BASE_URL is not set — cannot call CRM admin API',
      0,
      null,
    );
  }
  const token = await getIdToken();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url =
    typeof window === 'undefined'
      ? new URL(normalizedPath, `${CRM_BASE}/`)
      : new URL('/api/crm-proxy', window.location.origin);
  if (typeof window !== 'undefined') {
    url.searchParams.set('path', normalizedPath);
  }
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    credentials: 'omit',
  });

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const payloadError =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error)
        : '';
    const msg = payloadError || `HTTP ${res.status}`;
    throw new AdminApiError(msg, res.status, payload);
  }

  return payload as T;
}

export function isCrmApiConfigured(): boolean {
  return !!CRM_BASE;
}
