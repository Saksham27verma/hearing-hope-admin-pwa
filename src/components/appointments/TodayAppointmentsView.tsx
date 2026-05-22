'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import Grid from '@mui/material/GridLegacy';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { doc, orderBy, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { CalendarCheck, CalendarClock, CalendarX, CheckCircle2, Clock3, Home, MapPin, Phone, UserRound } from 'lucide-react';
import { db } from '@/firebase/config';
import { useCollection } from '@/lib/hooks/useCollection';
import { useCenterScope } from '@/lib/hooks/useCenterScope';
import { COLLECTIONS, type AppointmentDoc, type CenterDoc } from '@/lib/firestore/queries';
import { appointmentMatchesDataScope } from '@/lib/tenant/centerScope';
import { appointmentStatusLabel, getAppointmentDate } from '@/lib/utils/analytics';
import { formatNumber } from '@/lib/utils/dateRanges';

const STATUS_TABS = ['All', 'Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No-show'];

type LookupDoc = { id: string; [key: string]: unknown };

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

function statusTone(label: string): 'success' | 'error' | 'warning' | 'info' {
  if (label === 'Completed') return 'success';
  if (label === 'Cancelled') return 'error';
  if (label === 'Rescheduled') return 'info';
  return 'warning';
}

export default function TodayAppointmentsView() {
  const theme = useTheme();
  const { effectiveCenterId, allowedCenterIds } = useCenterScope();
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [tab, setTab] = useState('All');
  const [selected, setSelected] = useState<AppointmentDoc | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [actionError, setActionError] = useState<string | null>(null);

  const day = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    return { start: d, end: new Date(`${date}T23:59:59.999`) };
  }, [date]);

  const { data: appointments, loading } = useCollection<AppointmentDoc>(COLLECTIONS.appointments, [orderBy('createdAt', 'desc')]);
  const { data: centers } = useCollection<CenterDoc>(COLLECTIONS.centers);
  const { data: enquiries } = useCollection<LookupDoc>(COLLECTIONS.enquiries);
  const { data: staff } = useCollection<LookupDoc>(COLLECTIONS.staff);

  const enquiryById = useMemo(() => new Map(enquiries.map((e) => [e.id, e])), [enquiries]);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const rows = useMemo(() => {
    return appointments
      .filter((a) => appointmentMatchesDataScope(a as any, effectiveCenterId, allowedCenterIds))
      .filter((a) => {
        const d = getAppointmentDate(a);
        return d && d >= day.start && d <= day.end;
      })
      .filter((a) => tab === 'All' || appointmentStatusLabel(a.status) === tab)
      .sort((a, b) => (getAppointmentDate(a)?.getTime() || 0) - (getAppointmentDate(b)?.getTime() || 0));
  }, [appointments, effectiveCenterId, allowedCenterIds, day, tab]);

  const allDayRows = useMemo(
    () => appointments.filter((a) => {
      if (!appointmentMatchesDataScope(a as any, effectiveCenterId, allowedCenterIds)) return false;
      const d = getAppointmentDate(a);
      return !!d && d >= day.start && d <= day.end;
    }),
    [appointments, effectiveCenterId, allowedCenterIds, day],
  );

  const counts = (label: string) => allDayRows.filter((a) => appointmentStatusLabel(a.status) === label).length;
  const centerName = (id?: string) => centers.find((c) => c.id === id)?.name || id || '—';

  const apptDate = (appt: AppointmentDoc) => getAppointmentDate(appt) ?? asDate(appt.appointmentDate) ?? asDate(appt.date);

  const enquiryFor = (appt: AppointmentDoc) => {
    const id = str(appt.enquiryId);
    return id ? enquiryById.get(id) : undefined;
  };

  const customerName = (appt: AppointmentDoc) => {
    const enquiry = enquiryFor(appt);
    return str(
      appt.patientName ||
        appt.customerName ||
        appt.name ||
        appt.title ||
        enquiry?.name ||
        enquiry?.customerName ||
        enquiry?.patientName ||
        enquiry?.fullName,
      'Unknown',
    );
  };

  const phone = (appt: AppointmentDoc) => {
    const enquiry = enquiryFor(appt);
    return str(appt.patientPhone || appt.phone || enquiry?.phone || enquiry?.mobile || enquiry?.contactNumber, '—');
  };

  const visitType = (appt: AppointmentDoc) => {
    const raw = str(appt.type || appt.appointmentType, 'center').toLowerCase();
    return raw === 'home' ? 'Home Visit' : raw === 'center' ? 'Center Visit' : raw.replace(/^./, (c) => c.toUpperCase());
  };

  const assignedStaff = (appt: AppointmentDoc) => {
    const isHome = str(appt.type || appt.appointmentType).toLowerCase() === 'home';
    const id = str(isHome ? appt.homeVisitorStaffId : appt.assignedStaffId) || str(appt.homeVisitorStaffId || appt.assignedStaffId || appt.staffId);
    const staffRow = id ? staffById.get(id) : undefined;
    return str(
      (isHome ? appt.homeVisitorName : appt.assignedStaffName) ||
        appt.homeVisitorName ||
        appt.assignedStaffName ||
        appt.staffName ||
        staffRow?.name ||
        staffRow?.displayName,
      '—',
    );
  };

  const appointmentCenterName = (appt: AppointmentDoc) => {
    const enquiry = enquiryFor(appt);
    const id = str(appt.centerId || appt.center || enquiry?.center || enquiry?.visitingCenter || enquiry?.centerId);
    return str(appt.centerName || centerName(id), '—');
  };

  const timeLabel = (appt: AppointmentDoc) => {
    const start = apptDate(appt);
    const end = asDate(appt.end) ?? asDate(appt.endTime);
    const startLabel = start ? start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : str(appt.time, '—');
    if (!end || !start) return startLabel;
    return `${startLabel} - ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  async function updateAppointment(appt: AppointmentDoc, patch: Record<string, unknown>) {
    if (!db) throw new Error('Database not initialized');
    await updateDoc(doc(db, COLLECTIONS.appointments, appt.id), {
      ...patch,
      updatedAt: Date.now(),
      adminPwaUpdatedAt: Date.now(),
    });
  }

  const handleComplete = async (appt: AppointmentDoc) => {
    try {
      setActionError(null);
      await updateAppointment(appt, { status: 'completed', completedAt: Date.now() });
      setSelected(null);
    } catch (err: any) {
      setActionError(err?.message || 'Could not mark appointment completed');
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    try {
      setActionError(null);
      await updateAppointment(selected, { status: 'cancelled', cancelledReason: cancelReason || 'Cancelled from Admin PWA', cancelledAt: Date.now() });
      setSelected(null);
      setCancelReason('');
    } catch (err: any) {
      setActionError(err?.message || 'Could not cancel appointment');
    }
  };

  const handleReschedule = async () => {
    if (!selected) return;
    try {
      setActionError(null);
      const next = new Date(rescheduleDate);
      const currentStart = apptDate(selected) || new Date();
      const currentEnd = asDate(selected.end) ?? asDate(selected.endTime);
      const duration = currentEnd ? Math.max(15 * 60 * 1000, currentEnd.getTime() - currentStart.getTime()) : 60 * 60 * 1000;
      const nextEnd = new Date(next.getTime() + duration);
      await updateAppointment(selected, {
        status: 'scheduled',
        rescheduledFrom: selected.start || getAppointmentDate(selected)?.getTime() || selected.date || null,
        start: next.toISOString(),
        end: nextEnd.toISOString(),
        appointmentDate: next.toISOString(),
        date: next.toISOString(),
      });
      setSelected(null);
    } catch (err: any) {
      setActionError(err?.message || 'Could not reschedule appointment');
    }
  };

  const columns: GridColDef<AppointmentDoc>[] = [
    { field: 'time', headerName: 'Time', minWidth: 150, valueGetter: (_v, r) => timeLabel(r) },
    { field: 'customerName', headerName: 'Enquiry / Patient', minWidth: 220, flex: 1, valueGetter: (_v, r) => customerName(r) },
    { field: 'phone', headerName: 'Phone', minWidth: 130, valueGetter: (_v, r) => phone(r) },
    { field: 'type', headerName: 'Type', minWidth: 130, valueGetter: (_v, r) => visitType(r) },
    { field: 'centerId', headerName: 'Center', minWidth: 160, valueGetter: (_v, r) => appointmentCenterName(r) },
    { field: 'staffName', headerName: 'Who will go', minWidth: 180, valueGetter: (_v, r) => assignedStaff(r) },
    { field: 'status', headerName: 'Status', minWidth: 140, renderCell: (p) => <Chip label={appointmentStatusLabel(p.row.status)} size="small" color={appointmentStatusLabel(p.row.status) === 'Completed' ? 'success' : appointmentStatusLabel(p.row.status) === 'Cancelled' ? 'error' : 'warning'} variant="outlined" /> },
  ];

  const statCards = [
    {
      title: 'Total Visits',
      value: allDayRows.length,
      subtitle: 'For selected day',
      icon: CalendarClock,
      color: theme.palette.primary.main,
    },
    {
      title: 'Scheduled',
      value: counts('Scheduled'),
      subtitle: 'Upcoming slots',
      icon: CalendarCheck,
      color: theme.palette.warning.main,
    },
    {
      title: 'Completed',
      value: counts('Completed'),
      subtitle: 'Closed visits',
      icon: CheckCircle2,
      color: theme.palette.success.main,
    },
    {
      title: 'Cancelled',
      value: counts('Cancelled'),
      subtitle: 'Needs follow-up',
      icon: CalendarX,
      color: theme.palette.error.main,
    },
  ];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Appointments & Bookings</Typography>
          <Typography color="text.secondary">Daily booking tracker with completion, cancellation and reschedule workflows.</Typography>
        </Box>
        <TextField type="date" label="Tracker date" size="small" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Stack>

      <Grid container spacing={1.5}>
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <Grid key={item.title} item xs={6} md={3}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  border: 0,
                  overflow: 'hidden',
                  background: `linear-gradient(145deg, ${alpha(item.color, 0.16)}, ${alpha(item.color, 0.045)} 54%, ${theme.palette.background.paper})`,
                  boxShadow: `0 14px 32px ${alpha(item.color, 0.12)}`,
                }}
              >
                <CardContent sx={{ p: { xs: 1.6, md: 2.2 } }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                    <Box>
                      <Typography color="text.secondary" sx={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ mt: 0.4, fontSize: { xs: 27, md: 34 }, lineHeight: 1, fontWeight: 950 }}>
                        {formatNumber(item.value)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8 }}>
                        {item.subtitle}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(item.color, 0.16), color: item.color, width: 38, height: 38 }}>
                      <Icon size={20} />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined">
        <CardContent>
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1.5, mb: 1 }}>
            {STATUS_TABS.map((s) => (
              <Chip
                key={s}
                clickable
                label={s}
                color={tab === s ? 'primary' : 'default'}
                variant={tab === s ? 'filled' : 'outlined'}
                onClick={() => setTab(s)}
                sx={{ fontWeight: 800, px: 0.5 }}
              />
            ))}
          </Stack>

          <Stack spacing={1.4} sx={{ display: { xs: 'flex', md: 'none' } }}>
            {rows.length ? rows.map((appt) => {
              const label = appointmentStatusLabel(appt.status);
              const isHome = visitType(appt) === 'Home Visit';
              return (
                <Card
                  key={appt.id}
                  variant="outlined"
                  onClick={() => {
                    setSelected(appt);
                    const d = apptDate(appt) || new Date();
                    setRescheduleDate(format(d, "yyyy-MM-dd'T'HH:mm"));
                  }}
                  sx={{
                    borderRadius: 4,
                    borderColor: alpha(theme.palette.primary.main, 0.18),
                    background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.08)}, ${theme.palette.background.paper} 42%)`,
                    boxShadow: `0 12px 30px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.28 : 0.07)}`,
                  }}
                >
                  <CardContent sx={{ p: 1.8 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
                      <Stack direction="row" spacing={1.2} alignItems="center" minWidth={0}>
                        <Avatar sx={{ bgcolor: isHome ? alpha(theme.palette.success.main, 0.16) : alpha(theme.palette.primary.main, 0.16), color: isHome ? 'success.main' : 'primary.main' }}>
                          {isHome ? <Home size={19} /> : <MapPin size={19} />}
                        </Avatar>
                        <Box minWidth={0}>
                          <Typography sx={{ fontWeight: 950, lineHeight: 1.15 }} noWrap>
                            {customerName(appt)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {visitType(appt)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip size="small" label={label} color={statusTone(label)} variant="outlined" sx={{ fontWeight: 800 }} />
                    </Stack>

                    <Box
                      sx={{
                        mt: 1.6,
                        p: 1.2,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.primary.main, 0.075),
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Clock3 size={17} color={theme.palette.primary.main} />
                      <Typography sx={{ fontWeight: 900 }}>{timeLabel(appt)}</Typography>
                    </Box>

                    <Grid container spacing={1.2} sx={{ mt: 0.4 }}>
                      <Grid item xs={6}>
                        <Stack direction="row" spacing={0.7} alignItems="center">
                          <Phone size={14} />
                          <Typography variant="caption" color="text.secondary" noWrap>{phone(appt)}</Typography>
                        </Stack>
                      </Grid>
                      <Grid item xs={6}>
                        <Stack direction="row" spacing={0.7} alignItems="center">
                          <UserRound size={14} />
                          <Typography variant="caption" color="text.secondary" noWrap>{assignedStaff(appt)}</Typography>
                        </Stack>
                      </Grid>
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={0.7} alignItems="center">
                          <MapPin size={14} />
                          <Typography variant="caption" color="text.secondary" noWrap>{appointmentCenterName(appt)}</Typography>
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              );
            }) : (
              <Alert severity="info">No appointments found for this date and filter.</Alert>
            )}
          </Stack>

          <Box sx={{ height: 560, width: '100%', display: { xs: 'none', md: 'block' } }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              pageSizeOptions={[25, 50, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              disableRowSelectionOnClick
              onRowClick={(p) => {
                setSelected(p.row);
                const d = apptDate(p.row) || new Date();
                setRescheduleDate(format(d, "yyyy-MM-dd'T'HH:mm"));
              }}
              sx={{ border: 0 }}
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Appointment Details</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{customerName(selected)}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}><Typography color="text.secondary">Phone</Typography><Typography fontWeight={700}>{phone(selected)}</Typography></Grid>
                <Grid item xs={6}><Typography color="text.secondary">Status</Typography><Typography fontWeight={700}>{appointmentStatusLabel(selected.status)}</Typography></Grid>
                <Grid item xs={6}><Typography color="text.secondary">Date/Time</Typography><Typography fontWeight={700}>{apptDate(selected)?.toLocaleString('en-IN') || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography color="text.secondary">Center</Typography><Typography fontWeight={700}>{appointmentCenterName(selected)}</Typography></Grid>
                <Grid item xs={6}><Typography color="text.secondary">Who will go</Typography><Typography fontWeight={700}>{assignedStaff(selected)}</Typography></Grid>
                <Grid item xs={6}><Typography color="text.secondary">Type</Typography><Typography fontWeight={700}>{visitType(selected)}</Typography></Grid>
              </Grid>
              <Divider />
              <TextField label="Cancellation reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} multiline minRows={2} />
              <TextField label="Reschedule to" type="datetime-local" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              {selected.notes && <Alert severity="info">{selected.notes}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {selected && (
            <>
              <Button onClick={() => handleComplete(selected)} color="success" variant="contained">Mark Completed</Button>
              <Button onClick={handleCancel} color="warning" variant="outlined">Cancel</Button>
              <Button onClick={handleReschedule} color="primary" variant="outlined">Reschedule</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
