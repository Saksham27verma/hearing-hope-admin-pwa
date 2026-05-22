'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { orderBy } from 'firebase/firestore';
import { BarChart3, BookOpenCheck, BookmarkPlus, Building2, Download, FileDown, IndianRupee, PhoneCall, RefreshCw, TrendingUp, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import KpiCard from '@/components/dashboard/KpiCard';
import { useAuth } from '@/context/AuthContext';
import { adminFetch } from '@/lib/api/adminApi';
import { useCollection } from '@/lib/hooks/useCollection';
import { useCenterScope } from '@/lib/hooks/useCenterScope';
import { COLLECTIONS, type CenterDoc, type EnquiryDoc, type SaleDoc, type StaffDoc } from '@/lib/firestore/queries';
import { enquiryMatchesDataScope, saleMatchesDataScope } from '@/lib/tenant/centerScope';
import { triggerPdfDownload } from '@/lib/crm/downloadCrmPdf';
import { downloadCrmReceiptPdf } from '@/lib/crm/downloadCrmReceiptPdf';
import { downloadCrmSalarySlipPdf } from '@/lib/crm/downloadCrmSalarySlipPdf';
import { bookingReceiptPayload, trialReceiptPayload } from '@/lib/crm/receiptPayload';
import { buildBookedRows, buildTrialRows, type BookedRow, type TrialRow } from '@/lib/reports/bookings';
import { buildPayslipRows, type PayslipRow, type SalaryDoc } from '@/lib/reports/payslips';
import { buildNormalizedSalesRows, groupSalesRows, summarizeNormalizedSales, type NormalizedSaleRow } from '@/lib/reports/sales';
import { buildTelecallingRows, filterTelecallingRows, telecallerStats, telecallingSeries } from '@/lib/reports/telecalling';
import { formatINR, formatNumber, PRESET_LABELS, rangeFromPreset, type DateRangePreset } from '@/lib/utils/dateRanges';

const REPORTS = ['Booked', 'Trials', 'Payslips', 'Sales', 'Telecallers', 'Profit'];
const PRESETS: Exclude<DateRangePreset, 'custom'>[] = ['today', 'this_week', 'this_month', 'last_30_days'];
const SALES_VIEWS = ['center', 'executive', 'source', 'week', 'company', 'records'] as const;

type SalesView = (typeof SALES_VIEWS)[number];

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function bookedDateLabel(row: BookedRow): string {
  if (row.bookingDate) return row.bookingDate.toLocaleDateString('en-IN');
  return '—';
}

function escapeCsv(value: unknown) {
  const s = (value ?? '').toString();
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(fileName: string, headers: string[], rows: unknown[][]) {
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsView() {
  const { userProfile } = useAuth();
  const { effectiveCenterId, allowedCenterIds } = useCenterScope();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(1);
  const [preset, setPreset] = useState<Exclude<DateRangePreset, 'custom'>>('this_month');
  const [salesView, setSalesView] = useState<SalesView>('center');
  const [search, setSearch] = useState('');
  const [bookedAssignedTo, setBookedAssignedTo] = useState('all');
  const [telecaller, setTelecaller] = useState('all');
  const [profit, setProfit] = useState<any | null>(null);
  const [profitError, setProfitError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);
  const range = useMemo(() => rangeFromPreset(preset), [preset]);

  const { data: sales } = useCollection<SaleDoc>(COLLECTIONS.sales, [orderBy('createdAt', 'desc')]);
  const { data: enquiries } = useCollection<EnquiryDoc>(COLLECTIONS.enquiries, [orderBy('createdAt', 'desc')]);
  const { data: centers } = useCollection<CenterDoc>(COLLECTIONS.centers);
  const { data: staff } = useCollection<StaffDoc>(COLLECTIONS.staff);
  const { data: salaries } = useCollection<SalaryDoc>(COLLECTIONS.salaries, [orderBy('month', 'desc')]);

  const scopedEnquiries = useMemo(
    () => enquiries.filter((e) => enquiryMatchesDataScope(e as any, effectiveCenterId, allowedCenterIds)),
    [enquiries, effectiveCenterId, allowedCenterIds],
  );
  const normalizedSales = useMemo(() => buildNormalizedSalesRows(sales, enquiries, centers), [sales, enquiries, centers]);
  const scopedSales = useMemo(
    () => normalizedSales.filter((s) => saleMatchesDataScope({ centerId: s.centerId }, effectiveCenterId, allowedCenterIds)),
    [normalizedSales, effectiveCenterId, allowedCenterIds],
  );
  const salesRows = useMemo(
    () => scopedSales.filter((s) => s.date && s.date >= range.start && s.date <= range.end),
    [scopedSales, range],
  );
  const salesSummary = useMemo(() => summarizeNormalizedSales(salesRows), [salesRows]);
  const bookedRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return buildBookedRows(scopedEnquiries, centers).filter((r) => {
      if (bookedAssignedTo !== 'all' && r.assignedTo.trim().toLowerCase() !== bookedAssignedTo.trim().toLowerCase()) return false;
      if (!q) return true;
      const haystack = [
        r.enquiryId,
        r.customerName,
        r.phone,
        r.email,
        r.assignedTo,
        r.centerName,
        r.brand,
        r.model,
        bookedDateLabel(r),
        r.advancePaidDateLabel,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [scopedEnquiries, centers, search, bookedAssignedTo]);
  const bookedAssignedOptions = useMemo(() => {
    const set = new Set<string>();
    buildBookedRows(scopedEnquiries, centers).forEach((r) => {
      if (r.assignedTo.trim()) set.add(r.assignedTo.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedEnquiries, centers]);
  const bookedSummary = useMemo(() => {
    const bookingValue = bookedRows.reduce((sum, row) => sum + row.bookingTotal, 0);
    const advance = bookedRows.reduce((sum, row) => sum + row.advance, 0);
    const lineMrp = bookedRows.reduce((sum, row) => sum + row.lineMrp, 0);
    const discount = bookedRows.reduce((sum, row) => sum + row.lineDiscountRupee, 0);
    return {
      bookingValue,
      advance,
      avgDiscountPct: lineMrp > 0 ? (100 * discount) / lineMrp : null,
    };
  }, [bookedRows]);
  const enquiryById = useMemo(() => new Map(scopedEnquiries.map((e) => [e.id, e])), [scopedEnquiries]);
  const trialRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return buildTrialRows(scopedEnquiries, centers).filter((r) => {
      if (!q) return true;
      const haystack = [r.customerName, r.phone, r.centerName, r.brandModel, r.status].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [scopedEnquiries, centers, search]);
  const payslipRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return buildPayslipRows(staff, salaries).filter((r) => {
      if (!q) return true;
      return [r.staffName, r.month, r.monthLabel].join(' ').toLowerCase().includes(q);
    });
  }, [staff, salaries, search]);
  const allCalls = useMemo(() => buildTelecallingRows(scopedEnquiries), [scopedEnquiries]);
  const callRows = useMemo(() => filterTelecallingRows(allCalls, range, telecaller), [allCalls, range, telecaller]);
  const callers = useMemo(() => ['all', ...new Set(allCalls.map((r) => r.telecaller).filter(Boolean))], [allCalls]);
  const callerStats = useMemo(() => telecallerStats(callRows, rangeFromPreset('today')), [callRows]);
  const callSeries = useMemo(() => telecallingSeries(callRows, 14), [callRows]);
  useEffect(() => {
    if (REPORTS[tab] !== 'Profit' || !userProfile?.isSuperAdmin) return;
    const from = range.start.toISOString().slice(0, 10);
    const to = range.end.toISOString().slice(0, 10);
    adminFetch<{ ok?: boolean; data?: any }>('/api/profit/summary', { query: { from, to } })
      .then((res) => {
        setProfit(res.data ?? res);
        setProfitError(null);
      })
      .catch((err) => {
        setProfit(null);
        const message = String(err?.message || '');
        if (/getaddrinfo|ENOTFOUND|www\.googleapis\.com/i.test(message)) {
          setProfitError('Profit report could not connect to Firebase from the CRM API. Please keep the CRM server online with internet access, then refresh this tab.');
        } else if (/401|missing authorization/i.test(message)) {
          setProfitError('Profit report needs a valid super-admin login. Please refresh after signing in again.');
        } else {
          setProfitError(message || 'Could not load profit summary from CRM API.');
        }
      });
  }, [tab, range, userProfile?.isSuperAdmin]);

  const visibleReports = useMemo(
    () => REPORTS.filter((r) => r !== 'Profit' || userProfile?.isSuperAdmin),
    [userProfile?.isSuperAdmin],
  );
  const active = visibleReports[tab] || visibleReports[0];
  const groupedSales = salesView === 'records' ? [] : groupSalesRows(salesRows, salesView);

  useEffect(() => {
    const report = searchParams.get('report');
    const view = searchParams.get('view');
    if (report) {
      const idx = visibleReports.findIndex((r) => r.toLowerCase() === report.toLowerCase());
      if (idx >= 0) setTab(idx);
    }
    if (view && (SALES_VIEWS as readonly string[]).includes(view)) {
      setSalesView(view as SalesView);
    }
  }, [searchParams, visibleReports]);

  const salesRecordColumns: GridColDef<NormalizedSaleRow>[] = [
    { field: 'date', headerName: 'Date', minWidth: 120, valueGetter: (_v, r) => r.date?.toLocaleDateString('en-IN') || '—' },
    { field: 'customerName', headerName: 'Customer', minWidth: 180, flex: 1 },
    { field: 'centerName', headerName: 'Center', minWidth: 150 },
    { field: 'executive', headerName: 'Executive', minWidth: 150 },
    { field: 'source', headerName: 'Source', minWidth: 150 },
    { field: 'company', headerName: 'Company', minWidth: 150 },
    { field: 'total', headerName: 'Sales', minWidth: 120, align: 'right', headerAlign: 'right', renderCell: (p) => formatINR(Number(p.value || 0)) },
    { field: 'status', headerName: 'Status', minWidth: 110, renderCell: (p) => <Chip size="small" label={p.value} color={p.value === 'paid' ? 'success' : p.value === 'overdue' ? 'error' : 'warning'} variant="outlined" /> },
  ];

  const downloadBookingReceipt = async (row: BookedRow) => {
    const enquiry = enquiryById.get(row.enquiryId);
    if (!enquiry) {
      setPdfError('Enquiry data not found for this booking.');
      return;
    }
    const payload = bookingReceiptPayload(enquiry, row.visitIndex, row.centerName);
    if (!payload) {
      setPdfError('Could not build booking receipt data.');
      return;
    }
    try {
      setPdfError(null);
      setPdfLoadingKey(`booking-${row.id}`);
      const { blob, fileName } = await downloadCrmReceiptPdf(payload);
      triggerPdfDownload(blob, fileName);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not download booking receipt.');
    } finally {
      setPdfLoadingKey(null);
    }
  };

  const downloadTrialReceipt = async (row: TrialRow) => {
    const enquiry = enquiryById.get(row.enquiryId);
    if (!enquiry) {
      setPdfError('Enquiry data not found for this trial.');
      return;
    }
    const payload = trialReceiptPayload(enquiry, row.visitIndex, row.centerName);
    if (!payload) {
      setPdfError('Could not build trial receipt data.');
      return;
    }
    try {
      setPdfError(null);
      setPdfLoadingKey(`trial-${row.id}`);
      const { blob, fileName } = await downloadCrmReceiptPdf(payload);
      triggerPdfDownload(blob, fileName);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not download trial receipt.');
    } finally {
      setPdfLoadingKey(null);
    }
  };

  const downloadPayslip = async (row: PayslipRow) => {
    try {
      setPdfError(null);
      setPdfLoadingKey(`payslip-${row.id}`);
      const { blob, fileName } = await downloadCrmSalarySlipPdf(row.staffId, row.month, row.staffName);
      triggerPdfDownload(blob, fileName);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not download payslip.');
    } finally {
      setPdfLoadingKey(null);
    }
  };

  const exportBookedCsv = () => {
    const headers = [
      'Enquiry ID',
      'Name',
      'Phone',
      'Email',
      'Center',
      'Assigned To',
      'Booking date',
      'Company',
      'Model',
      'MRP (unit)',
      'Qty',
      'Selling price (per unit)',
      'Booking total',
      'Discount % vs MRP',
      'Booking advance',
      'Advance paid date',
    ];
    const rows = bookedRows.map((r) => {
      const unitMrp = Number(r.unitMrp) || 0;
      const qty = Number(r.quantity) || 1;
      const total = Number(r.bookingTotal) || 0;
      const rowPct = unitMrp > 0 && qty > 0 && total > 0 ? (100 * Math.max(0, unitMrp * qty - total)) / (unitMrp * qty) : '';
      return [
        r.enquiryId,
        r.customerName,
        r.phone,
        r.email,
        r.centerName,
        r.assignedTo,
        bookedDateLabel(r),
        r.brand,
        r.model,
        String(r.unitMrp),
        String(r.quantity),
        String(r.unitSelling),
        String(r.bookingTotal),
        rowPct === '' ? '' : `${Number(rowPct).toFixed(1)}%`,
        String(r.advance),
        r.advancePaidDateLabel,
      ];
    });
    downloadCsv('booked-enquiries-report.csv', headers, rows);
  };

  const exportRows = (name: string, rows: unknown[]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows as any[]), name.slice(0, 28));
    XLSX.writeFile(wb, `hope-admin-${name.toLowerCase()}-${preset}.xlsx`);
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: 25, md: 34 } }}>Business Reports</Typography>
          <Typography color="text.secondary" sx={{ fontSize: { xs: 13, md: 15 } }}>CRM-grade Sales, Booked, Telecaller and Profit reports built for mobile checks.</Typography>
        </Box>
        <TextField select size="small" label="Range" value={preset} onChange={(e) => setPreset(e.target.value as any)} sx={{ minWidth: { xs: 132, md: 190 } }}>
          {PRESETS.map((p) => <MenuItem key={p} value={p}>{PRESET_LABELS[p]}</MenuItem>)}
        </TextField>
      </Stack>

      <Card variant="outlined" sx={{ position: 'sticky', top: 80, zIndex: 4 }}>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {visibleReports.map((r) => <Tab key={r} label={r} />)}
        </Tabs>
      </Card>

      {pdfError ? <Alert severity="error" onClose={() => setPdfError(null)}>{pdfError}</Alert> : null}

      {active === 'Sales' && (
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid item xs={6} md={3}><KpiCard title="Sales" value={formatINR(salesSummary.total)} subtitle={`${salesSummary.count} records`} icon={IndianRupee} /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Receipts" value={formatINR(salesSummary.paid)} subtitle="Collected" icon={TrendingUp} tone="success" /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Pending" value={formatINR(salesSummary.outstanding)} subtitle="Outstanding" icon={BarChart3} tone="warning" /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Avg Disc" value={`${salesSummary.avgDiscountPct.toFixed(1)}%`} subtitle="Against MRP" icon={Download} tone="info" /></Grid>
          </Grid>
          <Stack direction="row" gap={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {SALES_VIEWS.map((view) => <Chip key={view} clickable color={salesView === view ? 'primary' : 'default'} label={view.replace(/^./, (c) => c.toUpperCase())} onClick={() => setSalesView(view)} />)}
          </Stack>
          {salesView !== 'records' ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <Card variant="outlined"><CardContent><Typography fontWeight={800} mb={2}>{salesView} wise sales</Typography><Box sx={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={groupedSales.slice(0, 8)} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`} /><YAxis type="category" width={96} dataKey="name" tick={{ fontSize: 11 }} /><ChartTooltip formatter={(v: any) => formatINR(Number(v))} /><Bar dataKey="sales" fill="#EE6417" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></Box></CardContent></Card>
              </Grid>
              <Grid item xs={12} md={7}>
                <Stack spacing={1.2}>
                  {groupedSales.map((r) => (
                    <Card key={r.name} variant="outlined"><CardContent sx={{ py: 1.5 }}><Stack direction="row" justifyContent="space-between" gap={2}><Box><Typography fontWeight={800}>{r.name}</Typography><Typography variant="caption" color="text.secondary">{r.invoices} records • Discount {r.avgDiscountPct.toFixed(1)}%</Typography></Box><Box textAlign="right"><Typography fontWeight={900}>{formatINR(r.sales)}</Typography><Typography variant="caption" color="text.secondary">Paid {formatINR(r.paid)}</Typography></Box></Stack></CardContent></Card>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          ) : (
            <Card variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between" mb={1}><Typography fontWeight={800}>All sales records</Typography><Button size="small" onClick={() => exportRows('sales', salesRows)}>Export</Button></Stack><Box sx={{ height: { xs: 520, md: 640 } }}><DataGrid rows={salesRows} columns={salesRecordColumns} pageSizeOptions={[25, 50, 100]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} sx={{ border: 0 }} /></Box></CardContent></Card>
          )}
        </Stack>
      )}

      {active === 'Booked' && (
        <Box>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="booked-assigned-label">Assigned To</InputLabel>
                  <Select
                    labelId="booked-assigned-label"
                    label="Assigned To"
                    value={bookedAssignedTo}
                    onChange={(e) => setBookedAssignedTo(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {bookedAssignedOptions.map((name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, phone, model, booking date…"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button fullWidth variant="outlined" startIcon={<RefreshCw size={18} />} sx={{ height: 40 }}>
                  Live Data
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button fullWidth variant="contained" startIcon={<Download size={18} />} onClick={exportBookedCsv} sx={{ height: 40 }}>
                  Export CSV
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <Paper elevation={0} variant="outlined">
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BookmarkPlus color="#EE6417" />
                <Box>
                  <Typography variant="h6">Booked Report</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active enquiries with a hearing-aid booking (latest booking visit per enquiry). Excludes sold / not interested / inactive.
                  </Typography>
                </Box>
              </Box>
              <Chip label={`${bookedRows.length} record${bookedRows.length === 1 ? '' : 's'}`} color="primary" variant="outlined" />
            </Box>

            <Box sx={{ px: 2, pb: 2, pt: 2 }}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Summary (filtered)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Bookings</Typography>
                    <Typography variant="h6">{bookedRows.length}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Total booking value</Typography>
                    <Typography variant="h6">{formatMoney(bookedSummary.bookingValue)}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Total advance</Typography>
                    <Typography variant="h6">{formatMoney(bookedSummary.advance)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary">Avg. discount vs MRP</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }} title="Σ(unit MRP − unit selling) × qty ÷ Σ(MRP × qty)">
                      {bookedSummary.avgDiscountPct != null ? `${bookedSummary.avgDiscountPct.toFixed(1)}%` : '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Weighted by booking line value
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Box>

            <TableContainer sx={{ maxHeight: 640, width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
              <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '15%' }}>Name</TableCell>
                    <TableCell sx={{ width: '10%' }}>Phone</TableCell>
                    <TableCell sx={{ width: '12%' }}>Center</TableCell>
                    <TableCell sx={{ width: '11%' }}>Assigned</TableCell>
                    <TableCell sx={{ width: '10%' }}>Booking date</TableCell>
                    <TableCell sx={{ width: '24%' }}>Product</TableCell>
                    <TableCell align="right" sx={{ width: '5%' }}>Qty</TableCell>
                    <TableCell align="right" sx={{ width: '9%' }}>Booking total</TableCell>
                    <TableCell align="right" sx={{ width: '7%' }}>Disc. %</TableCell>
                    <TableCell align="right" sx={{ width: '11%' }}>Advance</TableCell>
                    <TableCell align="center" sx={{ width: '56px' }}>PDF</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bookedRows.length ? (
                    bookedRows.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>
                          <Typography color="primary" sx={{ fontWeight: 700 }}>{r.customerName}</Typography>
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>{r.phone || '—'}</TableCell>
                        <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>{r.centerName || '—'}</TableCell>
                        <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>{r.assignedTo || '—'}</TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>{bookedDateLabel(r)}</TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>
                            {r.brand}
                          </Typography>
                          <Typography variant="body2" color="text.primary" sx={{ mt: 0.25 }}>
                            {r.model}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            MRP {r.unitMrp > 0 ? formatMoney(r.unitMrp) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ verticalAlign: 'top' }}>{r.quantity}</TableCell>
                        <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                          {r.bookingTotal > 0 ? (
                            <>
                              <Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>
                                {formatMoney(r.bookingTotal)}
                              </Typography>
                              {r.unitSelling > 0 && r.quantity > 1 ? (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {formatMoney(r.unitSelling)} × {r.quantity}
                                </Typography>
                              ) : null}
                            </>
                          ) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                          {r.lineMrp > 0 && r.bookingTotal > 0
                            ? `${((100 * Math.max(0, r.lineMrp - r.bookingTotal)) / r.lineMrp).toFixed(1)}%`
                            : r.unitMrp > 0 && r.unitSelling > 0
                              ? `${((100 * Math.max(0, r.unitMrp - r.unitSelling)) / r.unitMrp).toFixed(1)}%`
                              : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                          {r.advance > 0 ? (
                            <>
                              <Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>
                                {formatMoney(r.advance)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Paid {r.advancePaidDateLabel}
                              </Typography>
                            </>
                          ) : '—'}
                        </TableCell>
                        <TableCell align="center" sx={{ verticalAlign: 'top' }}>
                          <Tooltip title="Download booking receipt (CRM template)">
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={pdfLoadingKey === `booking-${r.id}`}
                                onClick={() => void downloadBookingReceipt(r)}
                              >
                                {pdfLoadingKey === `booking-${r.id}` ? <CircularProgress size={18} /> : <FileDown size={18} />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                        No booked enquiries match this filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {active === 'Trials' && (
        <Box>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Active trial enquiries — PDFs use the same trial receipt template as live CRM.
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Search name, phone, center, device…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Paper>
          <TableContainer sx={{ maxHeight: 640, overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell>Trial start</TableCell>
                  <TableCell>Trial end</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell align="center">PDF</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trialRows.length ? (
                  trialRows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell><Typography fontWeight={700}>{r.customerName}</Typography></TableCell>
                      <TableCell>{r.phone || '—'}</TableCell>
                      <TableCell>{r.centerName}</TableCell>
                      <TableCell>{r.trialStartDate ? r.trialStartDate.toLocaleDateString('en-IN') : '—'}</TableCell>
                      <TableCell>{r.trialEndDate ? r.trialEndDate.toLocaleDateString('en-IN') : '—'}</TableCell>
                      <TableCell>{r.brandModel}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Download trial receipt (CRM template)">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={pdfLoadingKey === `trial-${r.id}`}
                              onClick={() => void downloadTrialReceipt(r)}
                            >
                              {pdfLoadingKey === `trial-${r.id}` ? <CircularProgress size={18} /> : <FileDown size={18} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>No active trials match this filter.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {active === 'Payslips' && (
        <Box>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Staff salary slips from Firestore — rendered by live CRM (same template as Staff → Salary slip).
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Search staff name or month…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Paper>
          <TableContainer sx={{ maxHeight: 640, overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Staff</TableCell>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Net salary</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">PDF</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payslipRows.length ? (
                  payslipRows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell><Typography fontWeight={700}>{r.staffName}</Typography></TableCell>
                      <TableCell>{r.monthLabel}</TableCell>
                      <TableCell align="right">{formatMoney(r.netSalary)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.isPaid ? 'Paid' : 'Pending'} color={r.isPaid ? 'success' : 'warning'} variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Download payslip (CRM template)">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={pdfLoadingKey === `payslip-${r.id}`}
                              onClick={() => void downloadPayslip(r)}
                            >
                              {pdfLoadingKey === `payslip-${r.id}` ? <CircularProgress size={18} /> : <FileDown size={18} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>No salary records found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {active === 'Telecallers' && (
        <Stack spacing={2}>
          <Stack direction="row" gap={1} sx={{ overflowX: 'auto' }}>
            {callers.map((c) => <Chip key={c} clickable color={telecaller === c ? 'primary' : 'default'} label={c === 'all' ? 'All telecallers' : c} onClick={() => setTelecaller(c)} />)}
          </Stack>
          <Grid container spacing={1.5}>
            <Grid item xs={6} md={3}><KpiCard title="Calls Logged" value={formatNumber(callRows.length)} subtitle={PRESET_LABELS[preset]} icon={PhoneCall} /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Connected" value={formatNumber(callerStats.reduce((s, r) => s + r.connected, 0))} subtitle="Positive calls" icon={Users} tone="success" /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Booked" value={formatNumber(callerStats.reduce((s, r) => s + r.booked, 0))} subtitle="Converted" icon={BookOpenCheck} tone="success" /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Overdue" value={formatNumber(callerStats.reduce((s, r) => s + r.overdue, 0))} subtitle="Missed due calls" icon={TrendingUp} tone="warning" /></Grid>
          </Grid>
          <Card variant="outlined"><CardContent><Typography fontWeight={800} mb={2}>Daily Call Trend</Typography><Box sx={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={callSeries}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><ChartTooltip /><Bar dataKey="calls" fill="#EE6417" /><Bar dataKey="booked" fill="#3aa986" /></BarChart></ResponsiveContainer></Box></CardContent></Card>
          <Stack spacing={1.2}>{callerStats.map((r) => <Card key={r.name} variant="outlined"><CardContent sx={{ py: 1.5 }}><Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={800}>{r.name}</Typography><Typography variant="caption" color="text.secondary">{r.connected} connected • {r.dueToday} due today • {r.overdue} overdue</Typography></Box><Box textAlign="right"><Typography fontWeight={900}>{r.calls}</Typography><Typography variant="caption">{r.conversionPct.toFixed(1)}% conv.</Typography></Box></Stack></CardContent></Card>)}</Stack>
        </Stack>
      )}

      {active === 'Profit' && (
        <Stack spacing={2}>
          {profitError && <Alert severity="warning">{profitError}</Alert>}
          {!profit && !profitError && <Alert severity="info">Loading profit summary from CRM…</Alert>}
          {profit && <Grid container spacing={1.5}>
            <Grid item xs={6} md={3}><KpiCard title="Revenue" value={formatINR(profit.grossRevenue || 0)} subtitle="Gross" icon={IndianRupee} /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Gross Profit" value={formatINR(profit.grossProfit || 0)} subtitle="After COGS" icon={TrendingUp} tone="success" /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Expenses" value={formatINR(profit.totalOperatingExpenses || 0)} subtitle="Operating" icon={Building2} tone="warning" /></Grid>
            <Grid item xs={6} md={3}><KpiCard title="Net Profit" value={formatINR(profit.netProfit || 0)} subtitle="Final" icon={BarChart3} tone={(profit.netProfit || 0) >= 0 ? 'success' : 'warning'} /></Grid>
          </Grid>}
          {profit?.centerRows && <Card variant="outlined"><CardContent><Typography fontWeight={800} mb={2}>Center profitability</Typography><Stack spacing={1}>{profit.centerRows.map((r: any) => <Card key={r.centerId || r.centerName} variant="outlined"><CardContent sx={{ py: 1.2 }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={800}>{r.centerName || r.centerId}</Typography><Typography fontWeight={900}>{formatINR(r.netProfit || r.grossProfit || 0)}</Typography></Stack></CardContent></Card>)}</Stack></CardContent></Card>}
        </Stack>
      )}
    </Stack>
  );
}
