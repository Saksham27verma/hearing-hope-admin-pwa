'use client';

import { Card, CardContent, Chip, Stack, Typography, Box } from '@mui/material';

export interface MobileReportMetric {
  label: string;
  value: string | number;
}

export default function MobileReportCard({
  title,
  subtitle,
  amount,
  status,
  metrics,
}: {
  title: string;
  subtitle?: string;
  amount?: string;
  status?: string;
  metrics?: MobileReportMetric[];
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 1.6, '&:last-child': { pb: 1.6 } }}>
        <Stack direction="row" justifyContent="space-between" gap={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={900} noWrap>{title}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          {amount && <Typography fontWeight={900} color="primary.main">{amount}</Typography>}
        </Stack>
        {(status || metrics?.length) && (
          <Stack direction="row" flexWrap="wrap" gap={0.8} sx={{ mt: 1 }}>
            {status && <Chip size="small" label={status} color="primary" variant="outlined" />}
            {metrics?.map((m) => <Chip key={m.label} size="small" label={`${m.label}: ${m.value}`} />)}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
