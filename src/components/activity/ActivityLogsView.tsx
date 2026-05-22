'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { orderBy, limit } from 'firebase/firestore';
import { ActivitySquare, Fingerprint, UsersRound } from 'lucide-react';
import KpiCard from '@/components/dashboard/KpiCard';
import { adminFetch, isCrmApiConfigured } from '@/lib/api/adminApi';
import { useCollection } from '@/lib/hooks/useCollection';
import { useCenterScope } from '@/lib/hooks/useCenterScope';
import { COLLECTIONS, type ActivityLogDoc } from '@/lib/firestore/queries';
import { activityLogMatchesDataScope } from '@/lib/tenant/centerScope';
import { formatNumber, inRange, PRESET_LABELS, rangeFromPreset, toDateSafe, type DateRangePreset } from '@/lib/utils/dateRanges';

const PRESETS: Exclude<DateRangePreset, 'custom'>[] = ['today', 'this_week', 'this_month', 'last_30_days'];

interface AdminActivityResponse {
  logs?: ActivityLogDoc[];
  data?: ActivityLogDoc[];
  items?: ActivityLogDoc[];
}

export default function ActivityLogsView() {
  const { effectiveCenterId, allowedCenterIds } = useCenterScope();
  const [preset, setPreset] = useState<Exclude<DateRangePreset, 'custom'>>('today');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [grouped, setGrouped] = useState(false);
  const [apiRows, setApiRows] = useState<ActivityLogDoc[] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const range = useMemo(() => rangeFromPreset(preset), [preset]);

  const { data: fallbackRows, loading } = useCollection<ActivityLogDoc>(COLLECTIONS.activityLogs, [orderBy('timestamp', 'desc'), limit(500)]);
  useEffect(() => {
    if (!isCrmApiConfigured()) return;
    const ctrl = new AbortController();
    adminFetch<AdminActivityResponse>('/api/admin/activity-logs', {
      query: { limit: 500 },
      signal: ctrl.signal,
    })
      .then((res) => {
        const rows = res.logs || res.data || res.items || [];
        setApiRows(rows);
        setApiError(null);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setApiError(err?.message || 'CRM admin activity API unavailable. Showing direct Firestore fallback.');
        setApiRows(null);
      });
    return () => ctrl.abort();
  }, []);

  const sourceRows = apiRows ?? fallbackRows;
  const usersWithActions = useMemo(() => [...new Set(sourceRows.map((r) => r.userName || r.userEmail || r.userId || 'Unknown'))].sort(), [sourceRows]);
  const actions = useMemo(() => [...new Set(sourceRows.map((r) => String(r.action || '')).filter(Boolean))].sort(), [sourceRows]);

  const rows = useMemo(() => {
    return sourceRows
      .filter((r) => activityLogMatchesDataScope(r as any, effectiveCenterId, allowedCenterIds))
      .filter((r) => inRange(r.timestamp, range))
      .filter((r) => userFilter === 'all' || (r.userName || r.userEmail || r.userId) === userFilter)
      .filter((r) => actionFilter === 'all' || r.action === actionFilter)
      .sort((a, b) => (toDateSafe(b.timestamp)?.getTime() || 0) - (toDateSafe(a.timestamp)?.getTime() || 0));
  }, [sourceRows, effectiveCenterId, allowedCenterIds, range, userFilter, actionFilter]);

  const uniqueUsers = new Set(rows.map((r) => r.userId || r.userEmail || r.userName).filter(Boolean)).size;
  const groupedRows = useMemo(() => {
    const map = new Map<string, { user: string; email: string; actions: number; modules: Set<string>; lastAction: Date | null }>();
    for (const row of rows) {
      const key = row.userId || row.userEmail || row.userName || 'unknown';
      const entry = map.get(key) || {
        user: row.userName || key,
        email: row.userEmail || '',
        actions: 0,
        modules: new Set<string>(),
        lastAction: null,
      };
      entry.actions += 1;
      if (row.module) entry.modules.add(row.module);
      const when = toDateSafe(row.timestamp);
      if (when && (!entry.lastAction || when > entry.lastAction)) entry.lastAction = when;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.actions - a.actions);
  }, [rows]);

  const columns: GridColDef<ActivityLogDoc>[] = [
    { field: 'timestamp', headerName: 'Time', minWidth: 170, valueGetter: (_v, r) => toDateSafe(r.timestamp)?.toLocaleString('en-IN') || '—' },
    { field: 'userName', headerName: 'User', minWidth: 180, flex: 0.8, valueGetter: (_v, r) => r.userName || r.userEmail || r.userId || 'Unknown' },
    { field: 'action', headerName: 'Action', minWidth: 130, renderCell: (p) => <Chip label={p.value || '—'} size="small" color="primary" variant="outlined" /> },
    { field: 'module', headerName: 'Module', minWidth: 150 },
    { field: 'entityName', headerName: 'Entity', minWidth: 190, flex: 0.8 },
    { field: 'description', headerName: 'Description', minWidth: 360, flex: 1.4 },
  ];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>User Activity Tracking</Typography>
        <Typography color="text.secondary">Audit trail showing exactly how many actions were taken and by which users.</Typography>
      </Box>

      {apiError && <Alert severity="info">{apiError}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><KpiCard title="Actions" value={formatNumber(rows.length)} subtitle="In selected range" icon={ActivitySquare} /></Grid>
        <Grid item xs={12} md={4}><KpiCard title="Active Users" value={formatNumber(uniqueUsers)} subtitle="Users with actions" icon={UsersRound} tone="success" /></Grid>
        <Grid item xs={12} md={4}><KpiCard title="Action Types" value={formatNumber(actions.length)} subtitle="Distinct audit actions" icon={Fingerprint} tone="info" /></Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mb: 2 }}>
            <TextField select label="Date range" size="small" value={preset} onChange={(e) => setPreset(e.target.value as any)} sx={{ minWidth: 190 }}>
              {PRESETS.map((p) => <MenuItem key={p} value={p}>{PRESET_LABELS[p]}</MenuItem>)}
            </TextField>
            <TextField select label="User" size="small" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} sx={{ minWidth: 230 }}>
              <MenuItem value="all">All users</MenuItem>
              {usersWithActions.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
            <TextField select label="Action" size="small" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} sx={{ minWidth: 190 }}>
              <MenuItem value="all">All actions</MenuItem>
              {actions.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Switch checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />} label="Group by user" />
          </Stack>

          {grouped ? (
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>User</TableCell><TableCell>Email</TableCell><TableCell align="right">Actions</TableCell><TableCell>Modules</TableCell><TableCell>Last Action</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {groupedRows.map((r) => (
                  <TableRow key={`${r.user}-${r.email}`}>
                    <TableCell sx={{ fontWeight: 700 }}>{r.user}</TableCell>
                    <TableCell>{r.email || '—'}</TableCell>
                    <TableCell align="right">{r.actions}</TableCell>
                    <TableCell>{Array.from(r.modules).join(', ') || '—'}</TableCell>
                    <TableCell>{r.lastAction?.toLocaleString('en-IN') || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Box sx={{ height: 620, width: '100%' }}>
              <DataGrid rows={rows} columns={columns} loading={loading && !apiRows} pageSizeOptions={[25, 50, 100]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} disableRowSelectionOnClick sx={{ border: 0 }} />
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
