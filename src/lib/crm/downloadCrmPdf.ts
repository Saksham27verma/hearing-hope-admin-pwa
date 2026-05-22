import { auth } from '@/firebase/config';

const CRM_BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE_URL || '').replace(/\/$/, '');

export class CrmPdfError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

async function getIdToken(): Promise<string | null> {
  const u = auth?.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken();
  } catch {
    return null;
  }
}

function parseCrmErrorMessage(text: string, status: number): string {
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j?.error) return j.error;
  } catch {
    // not JSON
  }
  const trimmed = text.trim();
  if (trimmed) return trimmed.slice(0, 500);
  if (status === 0) {
    return 'Network error while contacting the live CRM. Check NEXT_PUBLIC_CRM_API_BASE_URL and redeploy CRM after CORS updates.';
  }
  return `CRM PDF request failed (HTTP ${status || 'unknown'}).`;
}

function resolveCrmUrl(apiPath: string, query?: Record<string, string>): string {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (CRM_BASE && /^https?:\/\//i.test(CRM_BASE)) {
    const url = new URL(path, `${CRM_BASE}/`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }
  const proxy = new URL('/api/crm-proxy', window.location.origin);
  proxy.searchParams.set('path', path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) proxy.searchParams.set(k, v);
    }
  }
  return proxy.toString();
}

export async function fetchCrmPdf(options: {
  apiPath: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string>;
  fileName: string;
}): Promise<{ blob: Blob; fileName: string }> {
  if (!CRM_BASE && typeof window !== 'undefined') {
    throw new CrmPdfError('NEXT_PUBLIC_CRM_API_BASE_URL is not set.');
  }

  const token = await getIdToken();
  const url = resolveCrmUrl(options.apiPath, options.query);

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? 'POST',
      mode: 'cors',
      headers: {
        Accept: 'application/pdf, application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'omit',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network request failed';
    throw new CrmPdfError(msg, 0);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    throw new CrmPdfError(parseCrmErrorMessage(text, res.status), res.status);
  }
  if (!contentType.includes('pdf')) {
    const text = await res.text();
    throw new CrmPdfError(parseCrmErrorMessage(text, res.status), res.status);
  }

  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] || options.fileName;
  return { blob: await res.blob(), fileName };
}

export function triggerPdfDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
