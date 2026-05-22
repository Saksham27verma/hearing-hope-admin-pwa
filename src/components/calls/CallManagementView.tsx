'use client';

import { useMemo, useState } from 'react';
import { Box, Card, CardContent, MenuItem, Stack, TextField, Typography, Chip, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { orderBy } from 'firebase/firestore';
import { CalendarClock, CheckCircle2, PhoneCall, PhoneForwarded, TrendingUp } from 'lucide-react';
import KpiCard from '@/components/dashboard/KpiCard';
import { useCollection } from '@/lib/hooks/useCollection';
import { useCenterScope } from '@/lib/hooks/useCenterScope';
import { COLLECTIONS, type EnquiryDoc } from '@/lib/firestore/queries';
import { enquiryMatchesDataScope } from '@/lib/tenant/centerScope';
import type { FollowUpRow } from '@/lib/utils/analytics';
import { buildTelecallingRows, telecallerStats, telecallingSeries } from '@/lib/reports/telecalling';
import { formatNumber, inRange, PRESET_LABELS, rangeFromPreset, type DateRangePreset } from '@/lib/utils/dateRanges';

const PRESETS: Exclude<DateRangePreset, 'custom'>[] = ['today', 'this_week', 'this_month', 'last_30_days'];
const FUNNEL_COLORS = ['#EE6417', '#f59e0b', '#3aa986', '#64748b'];

export default function CallManagementView() {
  const { effectiveCenterId, allowedCenterIds } = useCenterScope();
  const [preset, setPreset] = useState<Exclude<DateRangePreset, 'custom'>>('today');
  const [telecaller, setTelecaller] = useState('all');
  const [status, setStatus] = useState('all');
  const [dueTodayOnly, setDueTodayOnly] = useState(false);
  const range = useMemo(() => rangeFromPreset(preset), [preset]);
  const today = useMemo(() => rangeFromPreset('today'), []);

  const { data: enquiries, loading } = useCollection<EnquiryDoc>(COLLECTIONS.enquiries, [orderBy('createdAt', 'desc')]);

  const scopedEnquiries = useMemo(
    () => enquiries.filter((e) => enquiryMatchesDataScope(e as any, effectiveCenterId, allowedCenterIds)),
    [enquiries, effectiveCenterId, allowedCenterIds],
  );

  const allFollowUps = useMemo(() => buildTelecallingRows(scopedEnquiries), [scopedEnquiries]);
  const telecallers = useMemo(() => [...new Set(allFollowUps.map((f) => f.telecaller).filter(Boolean))].sort(), [allFollowUps]);

  const rows = useMemo(() => {
    return allFollowUps
      .filter((f) => inRange(f.date, range))
      .filter((f) => telecaller === 'all' || f.telecaller === telecaller)
      .filter((f) => status === 'all' || `${f.status} ${f.outcome}`.toLowerCase().includes(status))
      .filter((f) => !dueTodayOnly || (f.nextFollowUpDate && f.nextFollowUpDate >= today.start && f.nextFollowUpDate <= today.end));
  }, [allFollowUps, range, telecaller, status, dueTodayOnly, today]);

  const connected = rows.filter((r) => /connect|interested|book|visit|completed/i.test(`${r.status} ${r.outcome}`)).length;
  const booked = rows.filter((r) => /book|appointment|visit/i.test(`${r.status} ${r.outcome} ${r.enquiryStatus || ''}`)).length;
  const pendingCallbacks = allFollowUps.filter((r) => r.nextFollowUpDate && r.nextFollowUpDate >= today.start && r.nextFollowUpDate <= today.end).length;
  const overdue = allFollowUps.filter((r) => r.nextFollowUpDate && r.nextFollowUpDate < today.start && !/closed|completed|book/i.test(`${r.status} ${r.enquiryStatus || ''}`)).length;

  const funnelData = [
    { name: 'Calls', value: rows.length },
    { name: 'Connected', value: connected },
    { name: 'Booked', value: booked },
    { name: 'Pending', value: pendingCallbacks },
  ];

  const callSeries = useMemo(() => telecallingSeries(allFollowUps, 14), [allFollowUps]);
  const leaderboard = useMemo(() => {
    return telecallerStats(rows, today).map((r) => ({
      telecaller: r.name,
      calls: r.calls,
      booked: r.booked,
      connected: r.connected,
    })).slice(0, 8);
  }, [rows, today]);

  const columns: GridColDef<FollowUpRow>[] = [
    { field: 'date', headerName: 'Call Date', minWidth: 140, valueGetter: (_v, r) => r.date?.toLocaleDateString('en-IN') || '—' },
    { field: 'customerName', headerName: 'Customer', minWidth: 210, flex: 1 },
    { field: 'phone', headerName: 'Phone', minWidth: 130 },
    { field: 'telecaller', headerName: 'Telecaller', minWidth: 170 },
    { field: 'status', headerName: 'Status', minWidth: 130, renderCell: (p) => <Chip label={p.value || 'Pending'} size="small" variant="outlined" /> },
    { field: 'outcome', headerName: 'Outcome', minWidth: 180, flex: 1 },
    { field: 'nextFollowUpDate', headerName: 'Next Follow-up', minWidth: 150, valueGetter: (_v, r) => r.nextFollowUpDate?.toLocaleDateString('en-IN') || '—' },
    { field: 'note', headerName: 'Notes', minWidth: 240, flex: 1 },
  ];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Call Management</Typography>
        <Typography color="text.secondary">Monitor telecalling follow-ups, conversion funnel and user-wise call activity.</Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={2.4}><KpiCard title="Calls" value={formatNumber(rows.length)} subtitle="In selected range" icon={PhoneCall} /></Grid>
        <Grid item xs={12} sm={6} lg={2.4}><KpiCard title="Connected" value={formatNumber(connected)} subtitle="Positive responses" icon={PhoneForwarded} tone="success" /></Grid>
        <Grid item xs={12} sm={6} lg={2.4}><KpiCard title="Booked" value={formatNumber(booked)} subtitle="Converted to bookings" icon={CheckCircle2} tone="success" /></Grid>
        <Grid item xs={12} sm={6} lg={2.4}><KpiCard title="Due Today" value={formatNumber(pendingCallbacks)} subtitle="Pending callbacks" icon={CalendarClock} tone="warning" /></Grid>
        <Grid item xs={12} sm={6} lg={2.4}><KpiCard title="Overdue" value={formatNumber(overdue)} subtitle="Missed follow-ups" icon={TrendingUp} tone="warning" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Call Funnel</Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip />
                    <Funnel dataKey="value" data={funnelData} isAnimationActive>
                      <LabelList position="right" fill="currentColor" stroke="none" dataKey="name" />
                      {funnelData.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Call Volume Trend</Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="calls" fill="#EE6417" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="booked" fill="#3aa986" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mb: 2 }}>
            <TextField select label="Date range" size="small" value={preset} onChange={(e) => setPreset(e.target.value as any)} sx={{ minWidth: 190 }}>
              {PRESETS.map((p) => <MenuItem key={p} value={p}>{PRESET_LABELS[p]}</MenuItem>)}
            </TextField>
            <TextField select label="Telecaller" size="small" value={telecaller} onChange={(e) => setTelecaller(e.target.value)} sx={{ minWidth: 220 }}>
              <MenuItem value="all">All telecallers</MenuItem>
              {telecallers.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField select label="Status contains" size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 190 }}>
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="connected">Connected</MenuItem>
              <MenuItem value="book">Booked</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="cancel">Cancelled</MenuItem>
            </TextField>
            <TextField select label="Due filter" size="small" value={dueTodayOnly ? 'today' : 'all'} onChange={(e) => setDueTodayOnly(e.target.value === 'today')} sx={{ minWidth: 190 }}>
              <MenuItem value="all">All calls</MenuItem>
              <MenuItem value="today">Due today only</MenuItem>
            </TextField>
          </Stack>
          <Box sx={{ height: 560, width: '100%' }}>
            <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[25, 50, 100]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} disableRowSelectionOnClick sx={{ border: 0 }} />
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Telecaller Leaderboard</Typography>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Telecaller</TableCell><TableCell align="right">Calls</TableCell><TableCell align="right">Connected</TableCell><TableCell align="right">Booked</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(leaderboard.length ? leaderboard : [{ telecaller: 'No calls in range', calls: 0, connected: 0, booked: 0 }]).map((r) => (
                <TableRow key={r.telecaller}><TableCell sx={{ fontWeight: 600 }}>{r.telecaller}</TableCell><TableCell align="right">{r.calls}</TableCell><TableCell align="right">{r.connected}</TableCell><TableCell align="right">{r.booked}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
