'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { where } from 'firebase/firestore';
import { sortWhatsAppRequestsNewestFirst } from '@/lib/invoices/sortWhatsAppRequests';
import { useSnackbar } from 'notistack';
import { useCollection } from '@/lib/hooks/useCollection';
import {
  INVOICE_WHATSAPP_REQUESTS_COLLECTION,
  type InvoiceWhatsAppRequestWithId,
} from '@/lib/invoices/invoiceWhatsAppRequestTypes';
import {
  approveWhatsAppInvoiceRequest,
  rejectWhatsAppInvoiceRequest,
} from '@/lib/api/whatsappApprovals';

function formatWhen(createdAt: unknown): string {
  if (!createdAt) return '';
  const any = createdAt as { toDate?: () => Date; seconds?: number };
  const d =
    typeof any.toDate === 'function'
      ? any.toDate()
      : typeof any.seconds === 'number'
        ? new Date(any.seconds * 1000)
        : null;
  if (!d) return '';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function WhatsAppApprovalsView() {
  const searchParams = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();

  const { data: rawPending, loading, error } = useCollection<InvoiceWhatsAppRequestWithId>(
    INVOICE_WHATSAPP_REQUESTS_COLLECTION,
    [where('status', '==', 'pending')],
  );

  const pending = useMemo(
    () => sortWhatsAppRequestsNewestFirst(rawPending),
    [rawPending],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const selected = useMemo(
    () => pending.find((r) => r.id === selectedId) ?? pending[0] ?? null,
    [pending, selectedId],
  );

  useEffect(() => {
    const fromUrl = searchParams.get('request');
    if (fromUrl && pending.some((p) => p.id === fromUrl)) {
      setSelectedId(fromUrl);
    } else if (!selectedId && pending[0]) {
      setSelectedId(pending[0].id);
    }
  }, [searchParams, pending, selectedId]);

  const runApprove = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await approveWhatsAppInvoiceRequest(selected.id);
      if (result.ok) {
        enqueueSnackbar(`Invoice ${selected.invoiceNumber} sent on WhatsApp`, { variant: 'success' });
        setSelectedId(null);
      } else {
        enqueueSnackbar(result.error || 'Approve failed', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Approve failed', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  }, [selected, enqueueSnackbar]);

  const runReject = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await rejectWhatsAppInvoiceRequest(selected.id, rejectReason);
      if (result.ok) {
        enqueueSnackbar('Request rejected', { variant: 'info' });
        setRejectOpen(false);
        setRejectReason('');
        setSelectedId(null);
      } else {
        enqueueSnackbar(result.error || 'Reject failed', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Reject failed', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  }, [selected, rejectReason, enqueueSnackbar]);

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800}>
          WhatsApp invoice approvals
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Approve staff requests before invoices are sent to customers on WhatsApp.
        </Typography>
        {pending.length > 0 && (
          <Chip label={`${pending.length} pending`} color="warning" size="small" sx={{ mt: 1, fontWeight: 700 }} />
        )}
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error.message}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : pending.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography color="text.secondary">No pending requests.</Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {pending.map((r) => (
                <ListItemButton
                  key={r.id}
                  selected={selected?.id === r.id}
                  onClick={() => setSelectedId(r.id)}
                >
                  <ListItemText
                    primary={r.invoiceNumber}
                    secondary={`${r.customerName} · ${r.requestedBy?.name || 'Staff'}`}
                    primaryTypographyProps={{ fontWeight: 700 }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, minHeight: 480 }}>
          {!selected ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              Select a request to preview.
            </Typography>
          ) : (
            <>
              <Typography variant="subtitle1" fontWeight={800}>
                {selected.invoiceNumber}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selected.customerName} · {selected.customerPhone}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Requested by {selected.requestedBy?.name} ({selected.requestedBy?.role}) ·{' '}
                {formatWhen(selected.requestedAt)}
              </Typography>
              <Divider sx={{ my: 2 }} />
              {selected.pdfUrl ? (
                <Box
                  component="iframe"
                  src={selected.pdfUrl}
                  title="Invoice preview"
                  sx={{
                    width: '100%',
                    height: { xs: 360, md: 520 },
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                />
              ) : (
                <Typography color="warning.main">PDF preview unavailable.</Typography>
              )}
              <Button
                size="small"
                sx={{ mt: 1 }}
                href={selected.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                disabled={!selected.pdfUrl}
              >
                Open PDF
              </Button>
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained" color="success" disabled={busy} onClick={() => void runApprove()}>
                  {busy ? 'Processing…' : 'Approve & send'}
                </Button>
                <Button variant="outlined" color="warning" disabled={busy} onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </Box>

      <Dialog open={rejectOpen} onClose={() => !busy && setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject request</DialogTitle>
        <DialogContent>
          <TextField
            label="Reason (optional)"
            fullWidth
            multiline
            minRows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button color="warning" variant="contained" onClick={() => void runReject()} disabled={busy}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
