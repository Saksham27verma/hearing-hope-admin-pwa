'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import { BookmarkCheck, IndianRupee, X } from 'lucide-react';
import type { BookedRow } from '@/lib/reports/bookings';
import type { NormalizedSaleRow } from '@/lib/reports/sales';
import { getSaleDate } from '@/lib/utils/analytics';
import { formatINR, inRange, type DateRange } from '@/lib/utils/dateRanges';
import { DASHBOARD_CARD_RADIUS } from './dashboardUi';

export type LiveFeedItem =
  | {
      kind: 'sale';
      key: string;
      side: 'left';
      customerName: string;
      invoiceNumber: string;
      centerName: string;
      executive: string;
      amount: number;
    }
  | {
      kind: 'booking';
      key: string;
      side: 'right';
      customerName: string;
      centerName: string;
      assignedTo: string;
      amount: number;
      brandModel: string;
    };

type VisibleItem = LiveFeedItem & { toastId: string; enteredAt: number };

const slideInLeft = keyframes`
  from { transform: translateX(-108%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideInRight = keyframes`
  from { transform: translateX(108%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideOutLeft = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-108%); opacity: 0; }
`;

const slideOutRight = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(108%); opacity: 0; }
`;

const TOAST_MS = 9000;
const MAX_VISIBLE = 4;

function bookingIsToday(row: BookedRow, today: DateRange) {
  const d = row.advancePaidDate || row.bookingDate;
  return !!d && inRange(d, today);
}

function saleToFeedItem(s: NormalizedSaleRow): LiveFeedItem {
  return {
    kind: 'sale',
    key: `sale:${s.id}`,
    side: 'left',
    customerName: s.customerName || 'Customer',
    invoiceNumber: s.invoiceNumber || '—',
    centerName: s.centerName || '—',
    executive: s.executive || '—',
    amount: s.total,
  };
}

function bookingToFeedItem(b: BookedRow): LiveFeedItem {
  return {
    kind: 'booking',
    key: `booking:${b.enquiryId}:${b.visitIndex}`,
    side: 'right',
    customerName: b.customerName || 'Customer',
    centerName: b.centerName || '—',
    assignedTo: b.assignedTo || '—',
    amount: b.bookingTotal,
    brandModel: b.brandModel || '—',
  };
}

function seenStorageKey(today: DateRange) {
  const d = today.start;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `hh-admin-feed-seen-${y}-${m}-${day}`;
}

function loadPersistedSeen(today: DateRange): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(seenStorageKey(today));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistSeen(today: DateRange, seen: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(seenStorageKey(today), JSON.stringify([...seen]));
  } catch {
    /* ignore quota */
  }
}

function FeedToast({
  item,
  exiting,
  onDismiss,
}: {
  item: VisibleItem;
  exiting: boolean;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const isSale = item.kind === 'sale';
  const accent = isSale ? theme.palette.primary.main : theme.palette.success.main;
  const animIn = item.side === 'left' ? slideInLeft : slideInRight;
  const animOut = item.side === 'left' ? slideOutLeft : slideOutRight;

  return (
    <Box
      role="status"
      sx={{
        pointerEvents: 'auto',
        borderRadius: DASHBOARD_CARD_RADIUS,
        overflow: 'hidden',
        border: `1px solid ${alpha(accent, 0.35)}`,
        bgcolor: alpha(theme.palette.background.paper, 0.98),
        backdropFilter: 'blur(12px)',
        boxShadow: `0 16px 40px ${alpha(theme.palette.common.black, 0.18)}, 0 0 0 1px ${alpha(accent, 0.08)}`,
        animation: `${exiting ? animOut : animIn} 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 0.85,
          background: `linear-gradient(90deg, ${alpha(accent, 0.18)} 0%, transparent 72%)`,
          borderBottom: `1px solid ${alpha(accent, 0.12)}`,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {isSale ? <IndianRupee size={15} color={accent} /> : <BookmarkCheck size={15} color={accent} />}
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, color: accent }}>
              {isSale ? 'NEW SALE' : 'NEW BOOKING'}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onDismiss} aria-label="Dismiss" sx={{ p: 0.35, color: 'text.secondary' }}>
            <X size={16} />
          </IconButton>
        </Stack>
      </Box>
      <Box sx={{ px: 1.5, py: 1.15 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 20, letterSpacing: -0.4, color: accent, lineHeight: 1.1 }}>
          {formatINR(item.amount)}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 14, mt: 0.5 }} noWrap>
          {item.customerName}
        </Typography>
        {isSale ? (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.35,
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 700,
              color: 'text.secondary',
            }}
            noWrap
          >
            {item.invoiceNumber}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }} noWrap>
            {item.brandModel}
          </Typography>
        )}
        <Stack spacing={0.2} sx={{ mt: 0.75 }}>
          <DetailLine label="Center" value={item.centerName} />
          <DetailLine
            label={isSale ? 'Sold by' : 'Booked by'}
            value={isSale ? item.executive : item.assignedTo}
          />
        </Stack>
      </Box>
    </Box>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={1}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'right' }} noWrap>
        {value || '—'}
      </Typography>
    </Stack>
  );
}

export function useDashboardLiveFeed(
  scopedSales: NormalizedSaleRow[],
  bookedRows: BookedRow[],
  today: DateRange,
  enabled = true,
) {
  const seenRef = useRef<Set<string> | null>(null);
  const bootstrappedRef = useRef(false);
  const [visible, setVisible] = useState<VisibleItem[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((toastId: string) => {
    setExitingIds((prev) => new Set(prev).add(toastId));
    const existing = timersRef.current.get(toastId);
    if (existing) clearTimeout(existing);
    timersRef.current.set(
      toastId,
      setTimeout(() => {
        setVisible((v) => v.filter((x) => x.toastId !== toastId));
        setExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(toastId);
          return next;
        });
        timersRef.current.delete(toastId);
      }, 420),
    );
  }, []);

  const push = useCallback(
    (item: LiveFeedItem) => {
      const toastId = `${item.key}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setVisible((v) => {
        const next = [...v, { ...item, toastId, enteredAt: Date.now() }];
        while (next.length > MAX_VISIBLE) {
          const oldest = next.shift();
          if (oldest) {
            const t = timersRef.current.get(oldest.toastId);
            if (t) clearTimeout(t);
            timersRef.current.delete(oldest.toastId);
          }
        }
        return next;
      });
      const timer = setTimeout(() => dismiss(toastId), TOAST_MS);
      timersRef.current.set(toastId, timer);
    },
    [dismiss],
  );

  const pushMany = useCallback(
    (items: LiveFeedItem[], startDelayMs = 0) => {
      items.forEach((item, i) => {
        setTimeout(() => push(item), startDelayMs + i * 420);
      });
    },
    [push],
  );

  const ensureSeen = useCallback(() => {
    if (!seenRef.current) seenRef.current = loadPersistedSeen(today);
    return seenRef.current;
  }, [today]);

  const markSeen = useCallback(
    (key: string) => {
      const seen = ensureSeen();
      seen.add(key);
      persistSeen(today, seen);
    },
    [ensureSeen, today],
  );

  useEffect(() => {
    if (!enabled) return;

    const seen = ensureSeen();
    const todaySales = scopedSales.filter((s) => inRange(getSaleDate(s), today));
    const todayBookings = bookedRows.filter((b) => bookingIsToday(b, today));

    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      let changed = false;
      for (const s of todaySales) {
        const key = `sale:${s.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          changed = true;
        }
      }
      for (const b of todayBookings) {
        const key = `booking:${b.enquiryId}:${b.visitIndex}`;
        if (!seen.has(key)) {
          seen.add(key);
          changed = true;
        }
      }
      if (changed) persistSeen(today, seen);
      return;
    }

    const pending: LiveFeedItem[] = [];

    for (const s of todaySales) {
      const key = `sale:${s.id}`;
      if (seen.has(key)) continue;
      markSeen(key);
      pending.push(saleToFeedItem(s));
    }

    for (const b of todayBookings) {
      const key = `booking:${b.enquiryId}:${b.visitIndex}`;
      if (seen.has(key)) continue;
      markSeen(key);
      pending.push(bookingToFeedItem(b));
    }

    if (pending.length) pushMany(pending, 0);
  }, [enabled, scopedSales, bookedRows, today, pushMany, ensureSeen, markSeen]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return { visible, exitingIds, dismiss };
}

export default function LiveActivityFeed({
  visible,
  exitingIds,
  onDismiss,
}: {
  visible: VisibleItem[];
  exitingIds: Set<string>;
  onDismiss: (id: string) => void;
}) {
  const left = visible.filter((v) => v.side === 'left');
  const right = visible.filter((v) => v.side === 'right');

  if (visible.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: (t) => t.zIndex.snackbar + 2,
        px: { xs: 1, sm: 2 },
        pt: { xs: 7, sm: 8 },
        pb: 2,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 1.25,
          maxWidth: 920,
          mx: 'auto',
          height: '100%',
          alignContent: 'start',
        }}
      >
        <Stack spacing={1} sx={{ justifySelf: { md: 'start' }, width: '100%', maxWidth: { md: 360 } }}>
          {left.map((item) => (
            <FeedToast
              key={item.toastId}
              item={item}
              exiting={exitingIds.has(item.toastId)}
              onDismiss={() => onDismiss(item.toastId)}
            />
          ))}
        </Stack>
        <Stack spacing={1} sx={{ justifySelf: { md: 'end' }, width: '100%', maxWidth: { md: 360 }, ml: { md: 'auto' } }}>
          {right.map((item) => (
            <FeedToast
              key={item.toastId}
              item={item}
              exiting={exitingIds.has(item.toastId)}
              onDismiss={() => onDismiss(item.toastId)}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
