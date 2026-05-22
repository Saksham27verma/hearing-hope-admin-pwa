'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { AppColorMode } from './theme';
import { createAppTheme } from './theme';

export const COLOR_MODE_STORAGE_KEY = 'hope-admin-color-mode';

type AdminThemeContextValue = {
  mode: AppColorMode;
  followsSystem: boolean;
  setMode: (mode: AppColorMode) => void;
  toggleMode: () => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

function readStoredMode(): AppColorMode | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  return null;
}

function readSystemMode(): AppColorMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppColorMode>('light');
  const [followsSystem, setFollowsSystem] = useState(true);

  useLayoutEffect(() => {
    const stored = readStoredMode();
    if (stored) {
      setModeState(stored);
      setFollowsSystem(false);
    } else {
      setModeState(readSystemMode());
      setFollowsSystem(true);
    }
  }, []);

  useEffect(() => {
    if (!followsSystem) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setModeState(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [followsSystem]);

  const setMode = useCallback((next: AppColorMode) => {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    setModeState(next);
    setFollowsSystem(false);
  }, []);

  const toggleMode = useCallback(() => {
    const next: AppColorMode = mode === 'light' ? 'dark' : 'light';
    setMode(next);
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, followsSystem, setMode, toggleMode }),
    [mode, followsSystem, setMode, toggleMode],
  );

  const muiTheme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <AdminThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return ctx;
}
