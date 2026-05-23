'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
} from '@mui/material';
import { where } from 'firebase/firestore';
import { useSnackbar } from 'notistack';
import { useCollection } from '@/lib/hooks/useCollection';
import { sortWhatsAppRequestsNewestFirst } from '@/lib/invoices/sortWhatsAppRequests';
import {
  INVOICE_WHATSAPP_REQUESTS_COLLECTION,
  type InvoiceWhatsAppRequestWithId,
} from '@/lib/invoices/invoiceWhatsAppRequestTypes';
import {
  approveWhatsAppInvoiceRequest,
  rejectWhatsAppInvoiceRequest,
} from '@/lib/api/whatsappApprovals';
import { useWhatsAppApprovalLiveAlerts } from '@/hooks/useWhatsAppApprovalLiveAlerts';
import type { WhatsAppApprovalAlertItem } from '@/hooks/useWhatsAppApprovalLiveAlerts';
import WhatsAppApprovalLiveAlerts from './WhatsAppApprovalLiveAlerts';

export default function WhatsAppApprovalLiveAlertsHost() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const { data: rawPending } = useCollection<InvoiceWhatsAppRequestWithId>(
    INVOICE_WHATSAPP_REQUESTS_COLLECTION,
    [where('status', '==', 'pending')],
  );

  const pending = useMemo(
    () => sortWhatsAppRequestsNewestFirst(rawPending),
    [rawPending],
  );

  const { visible, exitingIds, dismiss, dismissByRequestId } = useWhatsAppApprovalLiveAlerts(
    pending,
    true,
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<WhatsAppApprovalAlertItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const runApprove = useCallback(
    async (item: WhatsAppApprovalAlertItem) => {
      setBusyId(item.id);
      try {
        const result = await approveWhatsAppInvoiceRequest(item.id);
        if (result.ok) {
          enqueueSnackbar(`Invoice ${item.invoiceNumber} sent on WhatsApp`, { variant: 'success' });
          dismissByRequestId(item.id);
        } else {
          enqueueSnackbar(result.error || 'Approve failed', { variant: 'error' });
        }
      } catch (e) {
        enqueueSnackbar(e instanceof Error ? e.message : 'Approve failed', { variant: 'error' });
      } finally {
        setBusyId(null);
      }
    },
    [enqueueSnackbar, dismissByRequestId],
  );

  const runReject = useCallback(async () => {
    if (!rejectItem) return;
    setBusyId(rejectItem.id);
    try {
      const result = await rejectWhatsAppInvoiceRequest(rejectItem.id, rejectReason);
      if (result.ok) {
        enqueueSnackbar('Request rejected', { variant: 'info' });
        dismissByRequestId(rejectItem.id);
        setRejectItem(null);
        setRejectReason('');
      } else {
        enqueueSnackbar(result.error || 'Reject failed', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Reject failed', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  }, [rejectItem, rejectReason, enqueueSnackbar, dismissByRequestId]);

  return (
    <>
      <WhatsAppApprovalLiveAlerts
        visible={visible}
        exitingIds={exitingIds}
        busyId={busyId}
        onDismiss={dismiss}
        onApprove={runApprove}
        onReject={(item) => setRejectItem(item)}
        onOpenPage={(item) =>
          router.push(`/whatsapp-approvals?request=${encodeURIComponent(item.id)}`)
        }
      />

      <Dialog open={!!rejectItem} onClose={() => !busyId && setRejectItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reject WhatsApp request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectItem(null)} disabled={!!busyId}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={runReject} disabled={!!busyId}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
