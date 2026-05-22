'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8.1 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.2 19 12 24 12c3.1 0 5.9 1.2 8.1 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z" />
    <path fill="#4CAF50" d="M24 44c5.1 0 9.8-2 13.4-5.2l-6.2-5.2C29.2 35.5 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.7 16.3 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-1.1 3.1-3.4 5.6-6.4 7.1l6.2 5.2C39.8 36.5 44 30.8 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const theme = useTheme();
  const { user, loading: authLoading, error: authError, signIn, signInWithGoogle, resetUserPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard');
  }, [user, authLoading, router]);

  const error = localError ?? authError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !password) {
      setLocalError('Enter both email and password.');
      return;
    }
    try {
      setSubmitting(true);
      await signIn(email.trim(), password);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    try {
      setSubmitting(true);
      await signInWithGoogle();
    } catch (err: any) {
      setLocalError(err?.message || 'Google sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setLocalError('Enter your email above, then tap Send reset link.');
      return;
    }
    setLocalError(null);
    setResetSent(false);
    try {
      setResetLoading(true);
      await resetUserPassword(trimmed);
      setResetSent(true);
    } catch (err: any) {
      setLocalError(err?.message || 'Could not send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          p: 6,
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, #f4894a 100%)`,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.18,
            backgroundImage:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.3) 0%, transparent 60%)',
          }}
        />
        <Box sx={{ position: 'relative', maxWidth: 460 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
            <ShieldCheck size={36} />
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              Hope Admin
            </Typography>
          </Stack>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.15, mb: 2 }}>
            One control panel for everything you run.
          </Typography>
          <Typography sx={{ opacity: 0.92, fontSize: 17, lineHeight: 1.55 }}>
            Monitor sales, calls, appointments, and audit activity across the entire Hearing Hope ecosystem in real time —
            from the same dashboard that powers your CRM and field PWAs.
          </Typography>

          <Stack direction="row" spacing={4} sx={{ mt: 5 }}>
            {[
              { k: '6+', v: 'Modules' },
              { k: '24/7', v: 'Live activity' },
              { k: '1', v: 'Source of truth' },
            ].map((s) => (
              <Box key={s.v}>
                <Typography sx={{ fontSize: 32, fontWeight: 800 }}>{s.k}</Typography>
                <Typography sx={{ opacity: 0.85, fontSize: 14 }}>{s.v}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, md: 6 },
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 440, boxShadow: 4 }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Admin & super-admin accounts only.
            </Typography>

            {resetSent && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setResetSent(false)}>
                Reset link sent. Open it and set a new password, then come back here.
              </Alert>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                margin="normal"
                size="medium"
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                margin="normal"
                size="medium"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                disabled={submitting || authLoading}
                sx={{ mt: 2.5, py: 1.4, fontSize: 16 }}
              >
                {submitting ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
              </Button>
            </Box>

            <Divider sx={{ my: 2.5 }}>OR</Divider>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleLogo />}
              onClick={handleGoogle}
              disabled={submitting || authLoading}
              sx={{ py: 1.25 }}
            >
              Continue with Google
            </Button>

            <Box sx={{ mt: 2.5, textAlign: 'center' }}>
              <Button
                variant="text"
                size="small"
                disabled={resetLoading || submitting}
                onClick={handleReset}
              >
                {resetLoading ? <CircularProgress size={16} /> : 'Send password reset link'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
