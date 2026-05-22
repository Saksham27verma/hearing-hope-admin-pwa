'use client';

import React from 'react';
import { ThemeRegistry } from '@/theme/ThemeRegistry';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '@/context/AuthContext';
import ServiceWorkerRegister from '@/components/common/ServiceWorkerRegister';

/**
 * Wraps the application in the providers needed across every route:
 *
 * - `ThemeRegistry` — MUI emotion SSR cache + theme provider (orange primary).
 * - `SnackbarProvider` — toast notifications.
 * - `AuthProvider` — Firebase auth + admin role gate.
 * - `ServiceWorkerRegister` — registers the Serwist service worker.
 */
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={3500}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <AuthProvider>
          {children}
          <ServiceWorkerRegister />
        </AuthProvider>
      </SnackbarProvider>
    </ThemeRegistry>
  );
}
