'use client';

import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardHeaderTitle() {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.25,
          display: 'grid',
          placeItems: 'center',
          background: `linear-gradient(135deg, ${alpha(accent, 0.9)} 0%, ${alpha(theme.palette.primary.dark, 0.95)} 100%)`,
          boxShadow: `0 6px 16px ${alpha(accent, 0.35)}`,
          flexShrink: 0,
        }}
      >
        <LayoutDashboard size={20} color="#fff" strokeWidth={2.25} />
      </Box>
      <Box minWidth={0}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: theme.palette.success.main,
              boxShadow: `0 0 0 3px ${alpha(theme.palette.success.main, 0.28)}`,
            }}
          />
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: 17, md: 18 },
              lineHeight: 1.1,
              letterSpacing: -0.25,
              color: 'inherit',
            }}
          >
            Dashboard
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: { xs: 'none', md: 'block' },
            fontWeight: 600,
            mt: 0.3,
          }}
        >
          {format(new Date(), 'EEEE, d MMMM')} · Live operations
        </Typography>
      </Box>
    </Stack>
  );
}
