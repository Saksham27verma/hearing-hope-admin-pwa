'use client';

import { Card, CardContent, Stack, Typography, Box, Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: 'primary' | 'success' | 'warning' | 'info';
  delta?: string;
}

const toneMap = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  info: 'info',
} as const;

export default function KpiCard({ title, value, subtitle, icon: Icon, tone = 'primary', delta }: KpiCardProps) {
  const theme = useTheme();
  const paletteKey = toneMap[tone];
  const main =
    paletteKey === 'primary'
      ? theme.palette.primary.main
      : paletteKey === 'success'
        ? theme.palette.success.main
        : paletteKey === 'warning'
          ? theme.palette.warning.main
          : theme.palette.info.main;

  return (
    <Card variant="outlined" sx={{ height: '100%', overflow: 'hidden' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.8 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 3,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(main, 0.12),
              color: main,
            }}
          >
            <Icon size={22} />
          </Box>
        </Stack>
        {delta && (
          <Chip
            label={delta}
            size="small"
            sx={{ mt: 2, bgcolor: alpha(main, 0.12), color: main, fontWeight: 700 }}
          />
        )}
      </CardContent>
    </Card>
  );
}
