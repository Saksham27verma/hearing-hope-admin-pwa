'use client';

import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export default function LoadingScreen({
  caption = 'Loading…',
  subcaption,
}: {
  caption?: string;
  subcaption?: string;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          boxShadow: `0 16px 36px ${theme.palette.primary.main}55`,
          animation: 'hh-pulse 2.6s ease-in-out infinite',
          color: '#fff',
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 1,
        }}
      >
        HH
      </Box>
      <CircularProgress size={22} color="primary" />
      <Typography variant="body1" fontWeight={600}>
        {caption}
      </Typography>
      {subcaption && (
        <Typography variant="body2" color="text.secondary">
          {subcaption}
        </Typography>
      )}
    </Box>
  );
}
