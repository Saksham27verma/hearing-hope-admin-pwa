'use client';

import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useCollection } from '@/lib/hooks/useCollection';
import {
  INVOICE_WHATSAPP_REQUESTS_COLLECTION,
  type InvoiceWhatsAppRequestWithId,
} from '@/lib/invoices/invoiceWhatsAppRequestTypes';

export function usePendingWhatsAppApprovalCount() {
  const { data, loading } = useCollection<InvoiceWhatsAppRequestWithId>(
    INVOICE_WHATSAPP_REQUESTS_COLLECTION,
    [where('status', '==', 'pending')],
  );

  const count = useMemo(() => data.length, [data]);

  return { count, loading };
}
