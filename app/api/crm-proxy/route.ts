import { NextResponse } from 'next/server';

/** Invoice PDF render via Puppeteer can take 10–60s on Vercel/local CRM. */
export const maxDuration = 60;

const CRM_BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE_URL || '').replace(/\/$/, '');
const CRM_FALLBACK = (
  process.env.CRM_API_FALLBACK_URL ||
  process.env.NEXT_PUBLIC_CRM_API_FALLBACK_URL ||
  ''
).replace(/\/$/, '');

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function buildCandidateBases(): string[] {
  const bases: string[] = [];
  if (CRM_BASE) bases.push(CRM_BASE);
  if (CRM_FALLBACK && CRM_FALLBACK !== CRM_BASE) bases.push(CRM_FALLBACK);

  // Only probe localhost when explicitly configured — not when using live Vercel CRM only.
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/i.test(CRM_BASE)) {
    for (const port of ['3001', '3002', '3000']) {
      const local = `http://localhost:${port}`;
      if (!bases.includes(local)) bases.push(local);
    }
  }

  return bases;
}

function fetchErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) {
      return `${err.message} (${cause.message})`;
    }
    return err.message;
  }
  return String(err);
}

async function proxyCrmRequest(req: Request) {
  if (!CRM_BASE) return jsonError('NEXT_PUBLIC_CRM_API_BASE_URL is not set', 500);

  const incomingUrl = new URL(req.url);
  const targetPath = incomingUrl.searchParams.get('path');
  if (!targetPath || !targetPath.startsWith('/api/')) {
    return jsonError('Valid CRM API path is required', 400);
  }

  const candidateBases = buildCandidateBases();
  const targetUrl = new URL(targetPath, `${candidateBases[0]}/`);
  incomingUrl.searchParams.forEach((value, key) => {
    if (key !== 'path') targetUrl.searchParams.append(key, value);
  });

  const headers: Record<string, string> = {
    Accept: req.headers.get('accept') || 'application/json, application/pdf',
  };
  const auth = req.headers.get('authorization');
  const requestContentType = req.headers.get('content-type');
  if (auth) headers.Authorization = auth;
  if (requestContentType) headers['Content-Type'] = requestContentType;

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  type Attempt = { base: string; status?: number; error: string };
  const attempts: Attempt[] = [];
  let crmRes: Response | null = null;

  for (const base of candidateBases) {
    const url = new URL(`${targetUrl.pathname}${targetUrl.search}`, `${base}/`);
    try {
      const res = await fetch(url.toString(), {
        method: req.method,
        headers,
        body,
        cache: 'no-store',
      });
      if (res.ok) {
        crmRes = res;
        break;
      }

      let error = `HTTP ${res.status}`;
      try {
        const errText = await res.text();
        const parsed = JSON.parse(errText) as { error?: string };
        error = parsed?.error || errText.slice(0, 400) || error;
      } catch {
        // keep HTTP status message
      }
      attempts.push({ base, status: res.status, error });
    } catch (err) {
      attempts.push({ base, error: fetchErrorMessage(err) });
    }
  }

  if (!crmRes?.ok) {
    const summary = attempts
      .map((a) => `${a.base}${a.status ? ` (${a.status})` : ''}: ${a.error}`)
      .join(' · ');
    const best =
      attempts.find((a) => a.status && a.status >= 500 && a.error.length > 10) ||
      attempts.find((a) => a.error.length > 10) ||
      attempts[attempts.length - 1];
    const headline = best?.error || 'CRM request could not be completed';
    return jsonError(summary ? `${headline} — Tried: ${summary}` : headline, 502);
  }

  const responseContentType = crmRes.headers.get('content-type') || 'application/json';
  const isBinary =
    responseContentType.includes('application/pdf') ||
    responseContentType.startsWith('image/') ||
    responseContentType.includes('octet-stream');

  if (isBinary) {
    const buffer = await crmRes.arrayBuffer();
    const responseHeaders: Record<string, string> = { 'Content-Type': responseContentType };
    const disposition = crmRes.headers.get('content-disposition');
    if (disposition) responseHeaders['Content-Disposition'] = disposition;
    return new NextResponse(buffer, { status: crmRes.status, headers: responseHeaders });
  }

  const text = await crmRes.text();
  return new NextResponse(text, {
    status: crmRes.status,
    headers: { 'Content-Type': responseContentType },
  });
}

export const GET = proxyCrmRequest;
export const POST = proxyCrmRequest;
export const PATCH = proxyCrmRequest;
export const DELETE = proxyCrmRequest;
