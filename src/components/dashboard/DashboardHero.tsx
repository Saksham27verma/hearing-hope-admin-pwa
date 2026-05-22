'use client';

import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { CalendarDays, Sparkles } from 'lucide-react';
import { DASHBOARD_CARD_RADIUS } from './dashboardUi';

interface DashboardHeroProps {
  greeting: string;
  firstName: string;
  now: Date;
  monthLabel: string;
}

export default function DashboardHero({ greeting, firstName, now, monthLabel }: DashboardHeroProps) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const accent = theme.palette.primary.main;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: DASHBOARD_CARD_RADIUS,
        border: `1px solid ${isLight ? alpha('#fff', 0.9) : alpha(theme.palette.divider, 0.5)}`,
        bgcolor: isLight ? '#FFFFFF' : alpha(theme.palette.background.paper, 0.96),
        boxShadow: isLight
          ? `0 2px 4px ${alpha('#0f172a', 0.04)}, 0 16px 48px ${alpha('#0f172a', 0.1)}`
          : `0 16px 40px ${alpha('#000', 0.4)}`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(180deg, ${accent} 0%, ${theme.palette.secondary.main} 100%)`,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: -60,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          bgcolor: alpha(accent, isLight ? 0.06 : 0.12),
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ px: { xs: 2, md: 2.5 }, py: { xs: 2, md: 2.25 }, pl: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: 1,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(accent, 0.1),
              color: accent,
            }}
          >
            <Sparkles size={14} />
          </Box>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            Business overview
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: 26, md: 32 },
            lineHeight: 1.08,
            letterSpacing: -0.6,
            color: 'text.primary',
          }}
        >
          {greeting},{' '}
          <Box component="span" sx={{ color: accent }}>
            {firstName}
          </Box>
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
          <CalendarDays size={14} color={theme.palette.text.secondary} />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {format(now, 'EEEE, d MMMM yyyy')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, opacity: 0.6 }}>
            ·
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {monthLabel}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
