/**
 * MUI theme for the Hope Admin PWA.
 *
 * Mirrors `hearing-hope-crm/src/theme/theme.ts` so the admin app looks identical
 * to the main CRM (orange #EE6417 primary, green #3aa986 secondary).
 */

import { alpha, createTheme, responsiveFontSizes } from '@mui/material/styles';

export type AppColorMode = 'light' | 'dark';

export const PRIMARY_ORANGE = '#EE6417';
export const PRIMARY_GREEN = '#3aa986';

const sharedTypography = {
  fontFamily: [
    'var(--font-inter)',
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: { fontWeight: 700 },
  h2: { fontWeight: 700 },
  h3: { fontWeight: 600 },
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
} as const;

export function createAppTheme(mode: AppColorMode) {
  const base = createTheme({
    palette: {
      mode,
      primary: {
        main: PRIMARY_ORANGE,
        dark: '#B84312',
        light: '#FF8F57',
        contrastText: '#ffffff',
      },
      secondary: {
        main: PRIMARY_GREEN,
        dark: '#2a9775',
        light: '#5bc4a3',
        contrastText: '#ffffff',
      },
      ...(mode === 'light'
        ? {
            background: {
              default: '#f6f7fb',
              paper: '#ffffff',
            },
            text: {
              primary: '#0f172a',
              secondary: 'rgba(15, 23, 42, 0.65)',
            },
            divider: '#e2e8f0',
          }
        : {
            background: {
              default: '#0a0b10',
              paper: '#13151c',
            },
            text: {
              primary: '#f1f5f9',
              secondary: 'rgba(241, 245, 249, 0.65)',
            },
            divider: alpha('#ffffff', 0.12),
          }),
    },
    typography: sharedTypography,
    shape: { borderRadius: 12 },
    transitions: {
      duration: { shortest: 150 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            transition: 'background-color 0.28s ease, color 0.28s ease',
          },
          body: {
            transition: 'background-color 0.28s ease, color 0.28s ease',
          },
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: mode === 'light' ? '#cbd5e1' : '#3b3f4d',
            borderRadius: 8,
          },
          '*::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 600,
            padding: '8px 16px',
          },
          containedPrimary: ({ theme }) => ({
            boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.35)}`,
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
              boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.45)}`,
            },
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 16,
            boxShadow:
              theme.palette.mode === 'light'
                ? '0px 4px 24px rgba(15, 23, 42, 0.06)'
                : '0px 4px 24px rgba(0, 0, 0, 0.4)',
            backgroundImage: 'none',
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundImage: 'none',
          },
          outlined: ({ theme }) => ({
            borderColor:
              theme.palette.mode === 'light'
                ? '#e2e8f0'
                : alpha(theme.palette.common.white, 0.12),
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: ({ theme }) => ({
            fontWeight: 600,
            backgroundColor:
              theme.palette.mode === 'light'
                ? theme.palette.grey[100]
                : alpha(theme.palette.common.white, 0.06),
            color: theme.palette.text.primary,
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 500 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 18 },
        },
      },
    },
  });

  return responsiveFontSizes(base);
}
