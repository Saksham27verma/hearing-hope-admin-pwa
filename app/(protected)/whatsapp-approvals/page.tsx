'use client';

import React, { Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import WhatsAppApprovalsView from '@/components/whatsapp/WhatsAppApprovalsView';

export default function WhatsAppApprovalsPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <WhatsAppApprovalsView />
    </Suspense>
  );
}
