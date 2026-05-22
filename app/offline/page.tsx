'use client';

import { Box, Button, Typography, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  const theme = useTheme();
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Stack alignItems="center" spacing={2} sx={{ textAlign: 'center', maxWidth: 460 }}>
        <Box
          sx={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            color: '#fff',
          }}
        >
          <WifiOff size={36} />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          You&apos;re offline
        </Typography>
        <Typography color="text.secondary">
          Hope Admin needs an internet connection to load live data. Reconnect and we&apos;ll bring you right back to where
          you left off.
        </Typography>
        <Button variant="contained" color="primary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Stack>
    </Box>
  );
}
