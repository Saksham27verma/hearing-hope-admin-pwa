import { alpha, type Theme } from '@mui/material/styles';

/** Tighter corners — premium, less “bubbly” than default MUI cards */
export const DASHBOARD_CARD_RADIUS = 1.25;

/** Page canvas — soft off-white, just a touch warmer than pure white */
export function dashboardPageBackground(theme: Theme) {
  const isLight = theme.palette.mode === 'light';
  const orange = theme.palette.primary.main;
  const green = theme.palette.secondary.main;
  return {
    minHeight: '100%',
    mx: { xs: -1.5, md: -3 },
    mt: { xs: -1.5, md: -3 },
    mb: { xs: -1, md: -2 },
    px: { xs: 1.5, md: 3 },
    pt: { xs: 1.5, md: 3 },
    pb: { xs: 1.5, md: 2 },
    borderRadius: 0,
    background: isLight
      ? `
        radial-gradient(ellipse 80% 50% at 0% 0%, ${alpha(orange, 0.06)} 0%, transparent 55%),
        radial-gradient(ellipse 60% 45% at 100% 100%, ${alpha(green, 0.05)} 0%, transparent 50%),
        linear-gradient(168deg, #F3F4F6 0%, #F7F8FA 42%, #FAFBFC 100%)
      `
      : `
        radial-gradient(ellipse 70% 50% at 0% 0%, ${alpha(orange, 0.1)} 0%, transparent 50%),
        linear-gradient(168deg, #14161c 0%, #181a22 50%, #12141a 100%)
      `,
  };
}

export function dashboardCardSx(theme: Theme, accent?: string) {
  const isLight = theme.palette.mode === 'light';
  const accentColor = accent || theme.palette.primary.main;
  return {
    borderRadius: DASHBOARD_CARD_RADIUS,
    bgcolor: isLight ? '#FFFFFF' : alpha('#1a1d28', 0.94),
    border: `1px solid ${isLight ? alpha('#fff', 0.95) : alpha(theme.palette.divider, 0.6)}`,
    boxShadow: isLight
      ? `0 1px 3px ${alpha('#0f172a', 0.06)}, 0 12px 32px ${alpha('#0f172a', 0.08)}`
      : `0 12px 32px ${alpha('#000', 0.45)}`,
    ...(accent
      ? {
          borderColor: alpha(accentColor, isLight ? 0.28 : 0.4),
        }
      : {}),
  };
}
