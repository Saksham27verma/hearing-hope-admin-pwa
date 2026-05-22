'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import AdminAppShell from '@/components/shell/AdminAppShell';
import LoadingScreen from '@/components/common/LoadingScreen';

/**
 * Auth + role gate that wraps every protected admin page.
 * - Loading → full-screen spinner.
 * - Unauthenticated → redirect to /login.
 * - Authenticated but non-admin → error screen with sign-out.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, userProfile, loading, error, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) return <LoadingScreen caption="Loading your workspace…" />;

  if (!user) return <LoadingScreen caption="Redirecting to sign-in…" />;

  if (!userProfile) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Stack spacing={2} sx={{ maxWidth: 460, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Account not authorized
          </Typography>
          <Alert severity="warning">{error || 'Your account does not have admin access to Hope Admin.'}</Alert>
          <Button variant="contained" color="primary" onClick={signOut}>
            Sign out
          </Button>
        </Stack>
      </Box>
    );
  }

  return <AdminAppShell>{children}</AdminAppShell>;
}
