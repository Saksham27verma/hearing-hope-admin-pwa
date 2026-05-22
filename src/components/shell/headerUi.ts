import { alpha, type Theme } from '@mui/material/styles';

export type HeaderChromeTone = 'light' | 'soft' | 'dark';

export const HEADER_ACTION_SIZE = 40;

export function headerBarSx(theme: Theme, tone: HeaderChromeTone) {
  const isDark = tone === 'dark';
  const isSoft = tone === 'soft';
  const isLight = theme.palette.mode === 'light';
  return {
    bgcolor: isDark
      ? alpha('#0c0e12', 0.96)
      : isSoft
        ? alpha(isLight ? '#F4F5F8' : '#1a1d26', 0.94)
        : alpha(theme.palette.background.paper, isLight ? 0.9 : 0.82),
    color: isDark ? '#F8FAFC' : theme.palette.text.primary,
    backdropFilter: 'saturate(180%) blur(18px)',
    WebkitBackdropFilter: 'saturate(180%) blur(18px)',
    borderBottom: `1px solid ${
      isDark ? alpha('#fff', 0.1) : isSoft ? alpha('#0f172a', isLight ? 0.06 : 0.2) : theme.palette.divider
    }`,
    boxShadow: isDark
      ? `0 8px 32px ${alpha('#000', 0.45)}, inset 0 1px 0 ${alpha('#fff', 0.06)}`
      : isSoft
        ? `0 2px 16px ${alpha('#0f172a', isLight ? 0.04 : 0.2)}`
        : `0 4px 20px ${alpha('#0f172a', 0.04)}`,
    ...(isDark
      ? {
          '& .MuiIconButton-root': { color: alpha('#fff', 0.92) },
          '& .MuiSvgIcon-root': { color: alpha('#fff', 0.92) },
        }
      : {}),
  };
}

export function headerActionSx(theme: Theme, tone: HeaderChromeTone) {
  const isDark = tone === 'dark';
  const isSoft = tone === 'soft';
  const isLight = theme.palette.mode === 'light';
  return {
    width: HEADER_ACTION_SIZE,
    height: HEADER_ACTION_SIZE,
    borderRadius: 1.25,
    border: `1px solid ${
      isDark ? alpha('#fff', 0.14) : isSoft ? alpha('#0f172a', isLight ? 0.08 : 0.2) : alpha(theme.palette.divider, 0.9)
    }`,
    bgcolor: isDark
      ? alpha('#fff', 0.06)
      : isSoft
        ? alpha(isLight ? '#fff' : '#fff', isLight ? 0.75 : 0.08)
        : alpha(theme.palette.primary.main, 0.04),
    color: isDark ? '#fff' : 'inherit',
    transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
    '&:hover': {
      bgcolor: isDark
        ? alpha('#fff', 0.12)
        : isSoft
          ? alpha(isLight ? '#fff' : '#fff', isLight ? 0.95 : 0.12)
          : alpha(theme.palette.primary.main, 0.1),
      borderColor: isDark
        ? alpha(theme.palette.primary.main, 0.45)
        : alpha(theme.palette.primary.main, isSoft ? 0.28 : 0.35),
    },
  };
}

export function headerMenuPaperSx(theme: Theme) {
  return {
    minWidth: 260,
    mt: 1,
    borderRadius: 1.25,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: `0 16px 48px ${alpha('#0f172a', 0.14)}`,
  };
}
