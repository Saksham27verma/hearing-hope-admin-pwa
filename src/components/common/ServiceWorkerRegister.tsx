'use client';

import { useEffect } from 'react';

/**
 * Registers the Serwist-generated service worker (`/sw.js`).
 *
 * Serwist (next plugin) handles the build-time generation; we only need to
 * tell the browser to register it once on the client. Disabled in dev
 * because `next.config.ts` sets `disable: isDev`.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          console.warn('[Hope Admin] SW register failed:', err);
        });
    };

    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
