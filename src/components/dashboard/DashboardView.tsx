'use client';

import { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  BookmarkCheck,
  CalendarCheck,
  ChevronRight,
  IndianRupee,
  PhoneCall,
  ReceiptText,
} from 'lucide-react';
import type { BookedRow } from '@/lib/reports/bookings';
import type { NormalizedSaleRow } from '@/lib/reports/sales';
import { orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import CenterWiseSalesChart from './CenterWiseSalesChart';
import DashboardHero from './DashboardHero';
import { dashboardCardSx, dashboardPageBackground } from './dashboardUi';
import LiveActivityFeed, { useDashboardLiveFeed } from './LiveActivityFeed';
import { useCollection } from '@/lib/hooks/useCollection';
import { useCenterScope } from '@/lib/hooks/useCenterScope';
import {
  COLLECTIONS,
  type AppointmentDoc,
  type CenterDoc,
  type EnquiryDoc,
  type SaleDoc,
} from '@/lib/firestore/queries';
import {
  appointmentMatchesDataScope,
  enquiryMatchesDataScope,
  saleMatchesDataScope,
} from '@/lib/tenant/centerScope';
import { buildBookedRows } from '@/lib/reports/bookings';
import { buildNormalizedSalesRows } from '@/lib/reports/sales';
import {
  appointmentStatusLabel,
  flattenFollowUps,
  getAppointmentDate,
  getSaleDate,
  summarizeSales,
} from '@/lib/utils/analytics';
import { formatINR, formatNumber, inRange, rangeFromPreset } from '@/lib/utils/dateRanges';

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function displayNameFromProfile(
  profile: { displayName?: string; nickname?: string; email?: string } | null,
  email?: string | null,
) {
  const name = profile?.displayName || profile?.nickname;
  if (name) return name.split(' ')[0];
  const mail = profile?.email || email;
  if (mail) return mail.split('@')[0];
  return 'there';
}

function str(v: unknown, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  return String(v).trim() || fallback;
}

function asDate(v: unknown): Date | null {
  if (!v) return null;
  const ts = v as { toDate?: () => Date; seconds?: number };
  if (typeof ts?.toDate === 'function') return ts.toDate();
  if (typeof ts?.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(v as string | number | Date);
  return Number.isFinite(d.getTime()) ? d : null;
}

function statusChipColor(label: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
  if (label === 'Completed') return 'success';
  if (label === 'Cancelled') return 'error';
  if (label === 'Rescheduled') return 'info';
  if (label === 'No-show') return 'warning';
  return 'default';
}

function appointmentTimeLabel(appt: AppointmentDoc) {
  const start = getAppointmentDate(appt) ?? asDate(appt.appointmentDate) ?? asDate(appt.date);
  if (!start) return str(appt.time, '—');
  return start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function appointmentCustomerName(appt: AppointmentDoc) {
  return str(appt.patientName || appt.customerName || appt.name || appt.title, 'Guest');
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  href,
  accent,
}: {
  icon: typeof IndianRupee;
  title: string;
  count: number;
  href: string;
  accent: string;
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(accent, 0.12),
            color: accent,
          }}
        >
          <Icon size={15} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
          {title}
          {count > 0 ? (
            <Typography component="span" color="text.secondary" sx={{ fontWeight: 600, ml: 0.5, fontSize: 13 }}>
              ({count})
            </Typography>
          ) : null}
        </Typography>
      </Stack>
      <Box
        component={Link}
        href={href}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          fontSize: 13,
          fontWeight: 700,
          color: 'primary.main',
          textDecoration: 'none',
        }}
      >
        All
        <ChevronRight size={16} />
      </Box>
    </Stack>
  );
}

function TodaySalesCard({ rows }: { rows: NormalizedSaleRow[] }) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  return (
    <Card variant="outlined" sx={dashboardCardSx(theme, accent)}>
      <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
        <SectionHeader icon={IndianRupee} title="Today's sales" count={rows.length} href="/sales" accent={accent} />
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1, fontSize: 13 }}>
            No sales recorded today yet.
          </Typography>
        ) : (
          <Stack divider={<Divider sx={{ opacity: 0.6 }} />}>
            {rows.map((row) => (
              <Stack key={row.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.85 }}>
                <Box minWidth={0} flex={1}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>
                    {row.customerName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'text.secondary' }}
                    noWrap
                  >
                    {row.invoiceNumber}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {row.centerName} · {row.executive || '—'}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: accent, flexShrink: 0 }}>
                  {formatINR(row.total)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function TodayBookingsCard({ rows }: { rows: BookedRow[] }) {
  const theme = useTheme();
  const accent = theme.palette.success.main;

  return (
    <Card variant="outlined" sx={dashboardCardSx(theme, accent)}>
      <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
        <SectionHeader icon={BookmarkCheck} title="Today's bookings" count={rows.length} href="/reports" accent={accent} />
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1, fontSize: 13 }}>
            No bookings recorded today yet.
          </Typography>
        ) : (
          <Stack divider={<Divider sx={{ opacity: 0.6 }} />}>
            {rows.map((row) => (
              <Stack key={`${row.enquiryId}-${row.visitIndex}`} direction="row" alignItems="center" spacing={1} sx={{ py: 0.85 }}>
                <Box minWidth={0} flex={1}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>
                    {row.customerName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {row.brandModel || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {row.centerName} · {row.assignedTo || '—'}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: accent, flexShrink: 0 }}>
                  {formatINR(row.bookingTotal)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function ExecutiveMetric({
  label,
  value,
  sub,
  href,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  href: string;
  icon: typeof IndianRupee;
  accent: string;
}) {
  const theme = useTheme();
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: 'block',
        px: { xs: 1.35, sm: 1.6 },
        py: 1.35,
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        background: `linear-gradient(160deg, ${alpha(accent, 0.1)} 0%, transparent 55%)`,
        transition: 'background 0.2s ease',
        '&:hover': {
          background: `linear-gradient(160deg, ${alpha(accent, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 12,
          right: 12,
          height: 2,
          borderRadius: 99,
          bgcolor: accent,
          opacity: 0.85,
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.65} sx={{ mb: 0.4 }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: 1.25,
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(accent, 0.14),
            color: accent,
          }}
        >
          <Icon size={13} strokeWidth={2.25} />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.6, color: 'text.secondary', textTransform: 'uppercase', fontSize: 10.5 }}>
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: 17, sm: 19 }, lineHeight: 1.1, letterSpacing: -0.35 }} noWrap>
        {value}
      </Typography>
      {sub ? (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25, fontWeight: 600 }}>
          {sub}
        </Typography>
      ) : null}
    </Box>
  );
}

export default function DashboardView() {
  const theme = useTheme();
  const { user, userProfile } = useAuth();
  const { effectiveCenterId, allowedCenterIds } = useCenterScope();

  const today = useMemo(() => rangeFromPreset('today'), []);
  const thisMonth = useMemo(() => rangeFromPreset('this_month'), []);
  const now = useMemo(() => new Date(), []);

  const { data: sales, loading: salesLoading } = useCollection<SaleDoc>(COLLECTIONS.sales, [orderBy('createdAt', 'desc')]);
  const { data: enquiries, loading: enquiriesLoading } = useCollection<EnquiryDoc>(COLLECTIONS.enquiries, [orderBy('createdAt', 'desc')]);
  const { data: appointments, loading: apptsLoading } = useCollection<AppointmentDoc>(COLLECTIONS.appointments, [orderBy('createdAt', 'desc')]);
  const { data: centers } = useCollection<CenterDoc>(COLLECTIONS.centers);

  const loading = salesLoading || enquiriesLoading || apptsLoading;

  const normalizedSales = useMemo(() => buildNormalizedSalesRows(sales, enquiries, centers), [sales, enquiries, centers]);
  const scopedSales = useMemo(
    () => normalizedSales.filter((s) => saleMatchesDataScope({ centerId: s.centerId }, effectiveCenterId, allowedCenterIds)),
    [normalizedSales, effectiveCenterId, allowedCenterIds],
  );
  const scopedEnquiries = useMemo(
    () => enquiries.filter((e) => enquiryMatchesDataScope(e as Parameters<typeof enquiryMatchesDataScope>[0], effectiveCenterId, allowedCenterIds)),
    [enquiries, effectiveCenterId, allowedCenterIds],
  );
  const scopedAppointments = useMemo(
    () => appointments.filter((a) => appointmentMatchesDataScope(a as Parameters<typeof appointmentMatchesDataScope>[0], effectiveCenterId, allowedCenterIds)),
    [appointments, effectiveCenterId, allowedCenterIds],
  );

  const monthSales = useMemo(() => summarizeSales(scopedSales, thisMonth), [scopedSales, thisMonth]);
  const monthSalesRows = useMemo(
    () => scopedSales.filter((s) => inRange(getSaleDate(s), thisMonth)),
    [scopedSales, thisMonth],
  );
  const todaySales = useMemo(() => summarizeSales(scopedSales, today), [scopedSales, today]);
  const bookedRows = useMemo(() => buildBookedRows(scopedEnquiries, centers), [scopedEnquiries, centers]);
  const totalBookingValue = useMemo(
    () => bookedRows.reduce((sum, row) => sum + (Number(row.bookingTotal) || 0), 0),
    [bookedRows],
  );
  const todaySalesRows = useMemo(
    () =>
      scopedSales
        .filter((s) => inRange(getSaleDate(s), today))
        .sort((a, b) => (getSaleDate(b)?.getTime() || 0) - (getSaleDate(a)?.getTime() || 0)),
    [scopedSales, today],
  );

  const bookingsToday = useMemo(
    () =>
      bookedRows
        .filter((b) => {
          const d = b.advancePaidDate || b.bookingDate;
          return !!d && inRange(d, today);
        })
        .sort((a, b) => {
          const bt = (b.advancePaidDate || b.bookingDate)?.getTime() || 0;
          const at = (a.advancePaidDate || a.bookingDate)?.getTime() || 0;
          return bt - at;
        }),
    [bookedRows, today],
  );

  const { visible: feedVisible, exitingIds, dismiss: dismissFeed } = useDashboardLiveFeed(
    scopedSales,
    bookedRows,
    today,
    !loading,
  );

  const followUps = useMemo(() => flattenFollowUps(scopedEnquiries), [scopedEnquiries]);
  const callsToday = useMemo(
    () => followUps.filter((f) => f.date && f.date >= today.start && f.date <= today.end),
    [followUps, today],
  );

  const todayAppointments = useMemo(() => {
    return scopedAppointments
      .filter((a) => {
        const d = getAppointmentDate(a);
        return d && d >= today.start && d <= today.end;
      })
      .sort((a, b) => (getAppointmentDate(a)?.getTime() || 0) - (getAppointmentDate(b)?.getTime() || 0));
  }, [scopedAppointments, today]);

  const apptStatusCounts = useMemo(() => {
    let scheduled = 0;
    let completed = 0;
    for (const appt of todayAppointments) {
      const label = appointmentStatusLabel(appt.status);
      if (label === 'Scheduled') scheduled += 1;
      else if (label === 'Completed') completed += 1;
    }
    return { scheduled, completed };
  }, [todayAppointments]);

  const centerName = (id?: string) => centers.find((c) => c.id === id)?.name || '—';
  const firstName = displayNameFromProfile(userProfile, user?.email);
  const monthLabel = format(thisMonth.start, 'MMM yyyy');

  const quickLinks = [
    { label: 'Sales', href: '/sales' },
    { label: 'Calls', href: '/calls' },
    { label: 'Appointments', href: '/appointments' },
    { label: 'Reports', href: '/reports' },
    { label: 'Inventory', href: '/inventory' },
  ];

  const gold = theme.palette.primary.main;

  return (
    <>
      <LiveActivityFeed visible={feedVisible} exitingIds={exitingIds} onDismiss={dismissFeed} />

      <Box sx={dashboardPageBackground(theme)}>
      <Stack spacing={1.5}>
        {loading && <LinearProgress sx={{ borderRadius: 99 }} />}

        <DashboardHero
          greeting={greetingForHour(now.getHours())}
          firstName={firstName}
          now={now}
          monthLabel={monthLabel}
        />

        <Card variant="outlined" sx={{ ...dashboardCardSx(theme, gold), overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
              '& > a': { borderRight: 1, borderBottom: 1, borderColor: alpha(theme.palette.divider, 0.9) },
              '& > a:nth-of-type(2n)': { borderRight: { xs: 0, sm: 1 } },
              '& > a:nth-of-type(n+3)': { borderBottom: { xs: 0, sm: 1 } },
              '& > a:last-of-type': { borderRight: 0 },
              '@media (min-width: 600px)': {
                '& > a': { borderBottom: 0 },
                '& > a:not(:last-of-type)': { borderRight: 1 },
              },
            }}
          >
            <ExecutiveMetric
              label="Sales · month"
              value={formatINR(monthSales.total)}
              sub={`${formatNumber(monthSales.count)} inv · ${formatINR(monthSales.paid)} in`}
              href="/sales"
              icon={IndianRupee}
              accent={theme.palette.primary.main}
            />
            <ExecutiveMetric
              label="Bookings"
              value={formatINR(totalBookingValue)}
              sub={`${formatNumber(bookedRows.length)} total · ${formatNumber(bookingsToday.length)} today`}
              href="/reports"
              icon={ReceiptText}
              accent={theme.palette.success.main}
            />
            <ExecutiveMetric
              label="Calls today"
              value={formatNumber(callsToday.length)}
              sub="Follow-ups logged"
              href="/calls"
              icon={PhoneCall}
              accent={theme.palette.warning.main}
            />
            <ExecutiveMetric
              label="Appointments"
              value={formatNumber(todayAppointments.length)}
              sub={
                todayAppointments.length
                  ? `${apptStatusCounts.scheduled} sched · ${apptStatusCounts.completed} done`
                  : 'None today'
              }
              href="/appointments"
              icon={CalendarCheck}
              accent={theme.palette.info.main}
            />
          </Box>
        </Card>

        <CenterWiseSalesChart rows={monthSalesRows} periodLabel={monthLabel} />

        <TodaySalesCard rows={todaySalesRows} />
        <TodayBookingsCard rows={bookingsToday} />

        <Card variant="outlined" sx={dashboardCardSx(theme)}>
          <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                >
                  <CalendarCheck size={15} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                  Today&apos;s appointments
                  {todayAppointments.length > 0 ? (
                    <Typography component="span" color="text.secondary" sx={{ fontWeight: 600, ml: 0.5, fontSize: 13 }}>
                      ({todayAppointments.length})
                    </Typography>
                  ) : null}
                </Typography>
              </Stack>
              <Box
                component={Link}
                href="/appointments"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'primary.main',
                  textDecoration: 'none',
                }}
              >
                All
                <ChevronRight size={16} />
              </Box>
            </Stack>

            {todayAppointments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1.25, fontSize: 13 }}>
                No appointments for today.
              </Typography>
            ) : (
              <Stack divider={<Divider sx={{ opacity: 0.6 }} />}>
                {todayAppointments.slice(0, 12).map((appt) => {
                  const status = appointmentStatusLabel(appt.status);
                  const start = getAppointmentDate(appt);
                  const isPast = start ? start.getTime() < now.getTime() && status === 'Scheduled' : false;

                  return (
                    <Stack
                      key={appt.id}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{
                        py: 0.85,
                        minHeight: 40,
                        borderRadius: 1,
                        mx: -0.5,
                        px: 0.5,
                        ...(isPast ? { bgcolor: alpha(theme.palette.warning.main, 0.06) } : {}),
                      }}
                    >
                      <Typography
                        sx={{
                          width: 44,
                          flexShrink: 0,
                          fontWeight: 700,
                          fontSize: 12,
                          fontFamily: 'ui-monospace, monospace',
                          color: isPast ? 'warning.main' : 'text.secondary',
                        }}
                      >
                        {appointmentTimeLabel(appt)}
                      </Typography>
                      <Box minWidth={0} flex={1}>
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>
                          {appointmentCustomerName(appt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {centerName(str(appt.centerId || appt.center))}
                        </Typography>
                      </Box>
                      <Chip
                        label={status}
                        size="small"
                        color={statusChipColor(status)}
                        variant="outlined"
                        sx={{ height: 22, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                      />
                    </Stack>
                  );
                })}
              </Stack>
            )}

            {todayAppointments.length > 12 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                +{todayAppointments.length - 12} more — open Appointments
              </Typography>
            ) : null}
          </CardContent>
        </Card>

        <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', pb: 0.25, '&::-webkit-scrollbar': { display: 'none' } }} useFlexGap flexWrap="wrap">
          {quickLinks.map((link) => (
            <Chip
              key={link.href}
              component={Link}
              href={link.href}
              clickable
              label={link.label}
              size="small"
              sx={{
                fontWeight: 700,
                flexShrink: 0,
                borderColor: alpha(gold, 0.35),
                bgcolor: alpha(gold, 0.06),
                '&:hover': { bgcolor: alpha(gold, 0.12) },
              }}
            />
          ))}
        </Stack>
      </Stack>
      </Box>
    </>
  );
}
