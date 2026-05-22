'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import Grid from '@mui/material/GridLegacy';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import {
  ChevronRight,
  Download,
  FileDown,
  FileText,
  IndianRupee,
  Phone,
  ReceiptText,
  Search,
  WalletCards,
  X,
} from 'lucide-react';
import { orderBy } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useCollection } from '@/lib/hooks/useCollection';
import { useCenterScope } from '@/lib/hooks/useCenterScope';
import { COLLECTIONS, type CenterDoc, type EnquiryDoc, type SaleDoc } from '@/lib/firestore/queries';
import { saleMatchesDataScope } from '@/lib/tenant/centerScope';
import { formatINR, inRange, PRESET_LABELS, rangeFromPreset, type DateRangePreset } from '@/lib/utils/dateRanges';
import { getSaleDate, getSaleTotal, summarizeSales } from '@/lib/utils/analytics';
import { buildNormalizedSalesRows, type NormalizedSaleRow } from '@/lib/reports/sales';
import { convertSaleToInvoiceData } from '@/lib/invoices/convertSaleToInvoiceData';
import { downloadCrmInvoicePdf, triggerPdfDownload } from '@/lib/invoices/downloadCrmInvoicePdf';
import { normalizedSaleToInvoicePayload } from '@/lib/invoices/normalizedSaleToInvoicePayload';
import { isCrmApiConfigured } from '@/lib/api/adminApi';

const PRESETS: Exclude<DateRangePreset, 'custom'>[] = ['today', 'this_week', 'this_month', 'last_30_days'];
const STATUS_OPTIONS = ['all', 'paid', 'pending', 'partial', 'overdue'] as const;

function hasInvoiceNumber(row: NormalizedSaleRow) {
  return row.sourceKind === 'invoice' && !!row.invoiceNumber && !/^uninvoiced/i.test(row.invoiceNumber);
}

function statusChipColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'error';
  if (status === 'partial' || status === 'pending') return 'warning';
  return 'default';
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2} sx={{ py: 1.1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }} noWrap>
        {value}
      </Typography>
    </Stack>
  );
}

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="overline"
        sx={{ fontWeight: 800, letterSpacing: 1.2, color: 'text.secondary', display: 'block', mb: 1 }}
      >
        {title}
      </Typography>
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent sx={{ py: 0.5, px: 2, '&:last-child': { pb: 1 } }}>{children}</CardContent>
      </Card>
    </Box>
  );
}

function InvoiceMobileCard({
  row,
  onOpen,
  onDownload,
  downloading,
}: {
  row: NormalizedSaleRow;
  onOpen: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const theme = useTheme();
  const date = getSaleDate(row);
  const canPdf = hasInvoiceNumber(row);

  const dateLabel = date
    ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <Card
      variant="outlined"
      onClick={onOpen}
      sx={{
        borderRadius: 3,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 'none',
        borderLeft: `3px solid ${theme.palette.primary.main}`,
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        '&:active': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box minWidth={0} flex={1}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  fontFamily: 'ui-monospace, monospace',
                  color: 'text.secondary',
                  letterSpacing: 0.3,
                }}
              >
                {row.invoiceNumber}
              </Typography>
              <Chip
                size="small"
                label={statusLabel(row.status)}
                color={statusChipColor(row.status)}
                variant="outlined"
                sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
              />
            </Stack>
            <Typography sx={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.25, letterSpacing: -0.2 }} noWrap>
              {row.customerName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }} noWrap>
              {[row.centerName, dateLabel].filter(Boolean).join(' · ')}
            </Typography>
            {row.source ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>
                Ref. {row.source}
              </Typography>
            ) : null}
          </Box>

          <Stack alignItems="flex-end" spacing={0.75} flexShrink={0} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: 'text.primary', letterSpacing: -0.3 }}>
              {formatINR(row.total)}
            </Typography>
            <Stack direction="row" spacing={0.25} alignItems="center">
              <IconButton
                size="small"
                aria-label="Download invoice PDF"
                disabled={!canPdf || downloading}
                onClick={onDownload}
                sx={{ color: 'primary.main' }}
              >
                {downloading ? <CircularProgress size={18} /> : <FileDown size={18} />}
              </IconButton>
              <IconButton size="small" aria-label="View details" onClick={onOpen} sx={{ color: 'text.secondary' }}>
                <ChevronRight size={20} />
              </IconButton>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function InvoiceDetailPanel({
  row,
  onClose,
  onDownload,
  downloading,
}: {
  row: NormalizedSaleRow;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const theme = useTheme();
  const date = getSaleDate(row);
  const canPdf = hasInvoiceNumber(row);

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Box
        sx={{
          px: 2,
          py: 1.75,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box minWidth={0}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              Invoice
            </Typography>
            <Typography
              sx={{
                fontWeight: 800,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 15,
                color: 'text.primary',
              }}
            >
              {row.invoiceNumber}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close" size="small" sx={{ mt: -0.5 }}>
            <X size={20} />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
        <Stack spacing={2.5}>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.03),
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>{row.customerName}</Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Invoice total
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 26, letterSpacing: -0.5, mt: 0.25 }}>
                  {formatINR(row.total)}
                </Typography>
              </Box>
              <Chip label={statusLabel(row.status)} color={statusChipColor(row.status)} variant="outlined" sx={{ fontWeight: 700 }} />
            </Stack>
          </Box>

          <SectionBlock title="Overview">
            <DetailRow label="Date" value={date ? date.toLocaleDateString('en-IN') : '—'} />
            <Divider />
            <DetailRow label="Center" value={row.centerName || '—'} />
            <Divider />
            <DetailRow label="Reference" value={row.source || '—'} />
            <Divider />
            <DetailRow label="Company" value={row.company || '—'} />
            <Divider />
            <DetailRow label="Executive" value={row.executive || '—'} />
          </SectionBlock>

          <SectionBlock title="Financials">
            <DetailRow label="Taxable amount" value={formatINR(row.taxable)} />
            <Divider />
            <DetailRow label="GST" value={formatINR(row.gst)} />
            <Divider />
            <DetailRow label="Grand total" value={formatINR(row.total)} />
          </SectionBlock>

          {row.phone ? (
            <SectionBlock title="Contact">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                <Phone size={16} color={theme.palette.text.secondary} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.phone}</Typography>
              </Stack>
            </SectionBlock>
          ) : null}

          <SectionBlock title="Line items">
            {row.products.length ? (
              row.products.map((item, index) => (
                <Box key={index}>
                  {index > 0 && <Divider />}
                  <Typography variant="body2" sx={{ py: 1.1, fontWeight: 600 }}>
                    {item}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1.2 }}>
                No line items recorded.
              </Typography>
            )}
          </SectionBlock>

          <SectionBlock title="Payment history">
            {row.paymentHistory.length ? (
              row.paymentHistory.map((p, index) => (
                <Box key={index}>
                  {index > 0 && <Divider />}
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ py: 1.15 }} gap={2}>
                    <Box minWidth={0}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {p.mode && p.mode !== '—' ? p.mode : 'Payment'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[p.referenceNumber ? `Ref ${p.referenceNumber}` : null, p.date].filter(Boolean).join(' · ') || '—'}
                      </Typography>
                      {p.remarks ? (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                          {p.remarks}
                        </Typography>
                      ) : null}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 800, flexShrink: 0 }}>
                      {formatINR(p.amount)}
                    </Typography>
                  </Stack>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1.2 }}>
                No payments recorded on this enquiry.
              </Typography>
            )}
          </SectionBlock>
        </Stack>
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'sticky',
          bottom: 0,
        }}
      >
        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={!canPdf || downloading}
          startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <FileDown size={18} />}
          onClick={onDownload}
          sx={{ py: 1.25, fontWeight: 700, borderRadius: 2.5, textTransform: 'none', boxShadow: 'none' }}
        >
          {downloading ? 'Preparing PDF…' : 'Download invoice PDF'}
        </Button>
      </Box>
    </Stack>
  );
}

export default function SalesFinancialsView() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { effectiveCenterId, allowedCenterIds } = useCenterScope();
  const [preset, setPreset] = useState<Exclude<DateRangePreset, 'custom'>>('this_month');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all');
  const [company, setCompany] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<NormalizedSaleRow | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const range = useMemo(() => rangeFromPreset(preset), [preset]);

  const { data: sales, loading } = useCollection<SaleDoc>(COLLECTIONS.sales, [orderBy('createdAt', 'desc')]);
  const { data: enquiries } = useCollection<EnquiryDoc>(COLLECTIONS.enquiries, [orderBy('createdAt', 'desc')]);
  const { data: centers } = useCollection<CenterDoc>(COLLECTIONS.centers);
  const normalizedSales = useMemo(() => buildNormalizedSalesRows(sales, enquiries, centers), [sales, enquiries, centers]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return normalizedSales
      .filter((s) => s.sourceKind === 'invoice')
      .filter((s) => saleMatchesDataScope({ centerId: s.centerId }, effectiveCenterId, allowedCenterIds))
      .filter((s) => inRange(getSaleDate(s), range))
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => company === 'all' || s.company === company)
      .filter((s) => {
        if (!q) return true;
        const hay = [s.invoiceNumber, s.customerName, s.phone, s.centerName, s.source, s.company, s.executive].join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [normalizedSales, effectiveCenterId, allowedCenterIds, range, status, company, search]);

  const summary = useMemo(() => summarizeSales(rows), [rows]);
  const taxSummary = useMemo(
    () => ({
      taxable: rows.reduce((sum, row) => sum + row.taxable, 0),
      gst: rows.reduce((sum, row) => sum + row.gst, 0),
    }),
    [rows],
  );
  const companies = useMemo(
    () => [...new Set(normalizedSales.map((s) => s.company).filter(Boolean))].sort(),
    [normalizedSales],
  );

  const kpiCards = useMemo(
    () => [
      { title: 'Total sales', value: formatINR(summary.total), subtitle: `${summary.count} invoices`, icon: IndianRupee, color: theme.palette.primary.main },
      { title: 'Taxable', value: formatINR(taxSummary.taxable), subtitle: 'Before GST', icon: ReceiptText, color: theme.palette.success.main },
      { title: 'GST', value: formatINR(taxSummary.gst), subtitle: 'Tax collected', icon: WalletCards, color: theme.palette.warning.main },
      { title: 'Avg / invoice', value: formatINR(summary.count ? summary.total / summary.count : 0), subtitle: 'In selected range', icon: FileText, color: theme.palette.info.main },
    ],
    [summary, taxSummary, theme],
  );

  const downloadInvoicePdf = async (row: NormalizedSaleRow) => {
    if (!hasInvoiceNumber(row)) {
      setPdfError('Only saved invoices with an invoice number can be downloaded as PDF.');
      return;
    }
    if (!isCrmApiConfigured()) {
      setPdfError('NEXT_PUBLIC_CRM_API_BASE_URL is not set — cannot render the CRM invoice PDF.');
      return;
    }
    try {
      setPdfError(null);
      setPdfLoadingId(row.id);
      const salePayload = normalizedSaleToInvoicePayload(row);
      const invoiceData = convertSaleToInvoiceData(salePayload);
      const { blob, fileName } = await downloadCrmInvoicePdf(invoiceData);
      triggerPdfDownload(blob, fileName);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not download invoice PDF from CRM.');
    } finally {
      setPdfLoadingId(null);
    }
  };

  const paymentHistoryBlock = (row: NormalizedSaleRow) => {
    if (!row.paymentHistory.length) {
      return <Typography variant="caption" color="text.secondary">—</Typography>;
    }
    return (
      <Stack spacing={0.4} sx={{ py: 0.5 }}>
        <Chip size="small" label={`${row.paymentHistory.length} payment${row.paymentHistory.length === 1 ? '' : 's'}`} sx={{ alignSelf: 'flex-start', height: 22, fontWeight: 700 }} />
        {row.paymentHistory.slice(0, 3).map((p, idx) => (
          <Typography key={idx} variant="caption" component="div" sx={{ lineHeight: 1.35 }}>
            <Box component="span" sx={{ fontWeight: 800 }}>{formatINR(p.amount)}</Box>
            {p.mode && p.mode !== '—' ? ` · ${p.mode}` : ''}
            {p.referenceNumber ? ` · ${p.referenceNumber}` : ''}
            {p.date ? <Typography component="span" display="block" variant="caption" color="text.secondary">{p.date}</Typography> : null}
          </Typography>
        ))}
      </Stack>
    );
  };

  const columns: GridColDef<NormalizedSaleRow>[] = [
    { field: 'invoiceNumber', headerName: 'Invoice #', minWidth: 150, flex: 0.8, renderCell: (p) => <Typography sx={{ fontWeight: 700 }}>{p.row.invoiceNumber}</Typography> },
    { field: 'invoiceDate', headerName: 'Date', minWidth: 130, valueGetter: (_v, row) => { const d = getSaleDate(row); return d ? d.toLocaleDateString('en-IN') : '—'; } },
    { field: 'customerName', headerName: 'Customer', minWidth: 220, flex: 1.1, renderCell: (p) => (<Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{p.row.customerName}</Typography><Typography variant="caption" color="text.secondary">{p.row.phone || '—'}</Typography></Box>) },
    { field: 'source', headerName: 'Reference', minWidth: 170, valueGetter: (_v, row) => row.source || '—' },
    { field: 'centerId', headerName: 'Center', minWidth: 160, valueGetter: (_v, row) => row.centerName },
    { field: 'paymentHistory', headerName: 'Patient payments', minWidth: 230, renderCell: (p) => paymentHistoryBlock(p.row) },
    { field: 'businessCompany', headerName: 'Company', minWidth: 160, valueGetter: (_v, row) => row.company || '—' },
    { field: 'grandTotal', headerName: 'Total', minWidth: 130, align: 'right', headerAlign: 'right', valueGetter: (_v, row) => getSaleTotal(row), renderCell: (p) => formatINR(Number(p.value || 0)) },
    { field: 'paymentStatus', headerName: 'Status', minWidth: 130, renderCell: (p) => <Chip label={p.row.status} size="small" color={statusChipColor(p.row.status)} variant="outlined" /> },
    { field: 'actions', headerName: 'Actions', minWidth: 150, sortable: false, renderCell: (p) => (<Button size="small" variant="outlined" startIcon={<FileDown size={15} />} disabled={!hasInvoiceNumber(p.row) || pdfLoadingId === p.row.id} onClick={(e) => { e.stopPropagation(); void downloadInvoicePdf(p.row); }}>PDF</Button>) },
  ];

  const exportRows = () => {
    const data = rows.map((r) => ({
      Invoice: r.invoiceNumber || r.id,
      Date: getSaleDate(r)?.toLocaleDateString('en-IN') || '',
      Customer: r.customerName,
      Phone: r.phone,
      Center: r.centerName,
      Company: r.company,
      Total: getSaleTotal(r),
      Status: r.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Sales');
    XLSX.writeFile(wb, `hope-admin-sales-${preset}.xlsx`);
  };

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontWeight: 950, fontSize: { xs: 26, md: 34 }, lineHeight: 1.1 }}>
            Sales & Financials
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: { xs: 13, md: 15 } }}>
            Invoices, tax breakdown, and CRM-matched PDF downloads.
          </Typography>
        </Box>
        {isMobile ? (
          <IconButton color="primary" onClick={exportRows} disabled={rows.length === 0} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 3 }}>
            <Download size={20} />
          </IconButton>
        ) : (
          <Button variant="contained" startIcon={<Download size={18} />} onClick={exportRows} disabled={rows.length === 0}>
            Export XLSX
          </Button>
        )}
      </Stack>

      <Grid container spacing={1.25}>
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <Grid key={item.title} item xs={6} md={3}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  border: 0,
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: `linear-gradient(145deg, ${alpha(item.color, 0.18)}, ${alpha(item.color, 0.04)} 55%, ${theme.palette.background.paper})`,
                  boxShadow: `0 12px 28px ${alpha(item.color, 0.14)}`,
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, md: 2.2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.45, color: 'text.secondary' }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ mt: 0.35, fontWeight: 950, fontSize: { xs: 18, md: 26 }, lineHeight: 1.05 }} noWrap>
                        {item.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {item.subtitle}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(item.color, 0.12),
                        color: item.color,
                      }}
                    >
                      <Icon size={18} />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card
        variant="outlined"
        sx={{
          borderRadius: 4,
          borderColor: alpha(theme.palette.primary.main, 0.12),
          overflow: 'hidden',
        }}
      >
        {loading && <LinearProgress />}
        <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
          {pdfError && <Alert severity="warning" sx={{ mb: 2, borderRadius: 3 }} onClose={() => setPdfError(null)}>{pdfError}</Alert>}

          <TextField
            fullWidth
            size="small"
            placeholder="Search invoice, customer, center, reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
            }}
          />

          <Stack spacing={1.25} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
              {PRESETS.map((p) => (
                <Chip
                  key={p}
                  clickable
                  label={PRESET_LABELS[p]}
                  color={preset === p ? 'primary' : 'default'}
                  variant={preset === p ? 'filled' : 'outlined'}
                  onClick={() => setPreset(p)}
                  sx={{ fontWeight: 800, flexShrink: 0 }}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
              {STATUS_OPTIONS.map((s) => (
                <Chip
                  key={s}
                  clickable
                  label={s === 'all' ? 'All statuses' : statusLabel(s)}
                  color={status === s ? 'primary' : 'default'}
                  variant={status === s ? 'filled' : 'outlined'}
                  onClick={() => setStatus(s)}
                  sx={{ fontWeight: 800, flexShrink: 0 }}
                />
              ))}
            </Stack>
            {!isMobile ? (
              <Stack direction="row" gap={2}>
                <TextField select label="Company" size="small" value={company} onChange={(e) => setCompany(e.target.value)} sx={{ minWidth: 220 }}>
                  <MenuItem value="all">All companies</MenuItem>
                  {companies.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              </Stack>
            ) : (
              <TextField select label="Company" size="small" fullWidth value={company} onChange={(e) => setCompany(e.target.value)}>
                <MenuItem value="all">All companies</MenuItem>
                {companies.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            )}
          </Stack>

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {rows.length} invoice{rows.length === 1 ? '' : 's'} · {PRESET_LABELS[preset]}
            </Typography>
          </Stack>

          <Stack spacing={1.35} sx={{ display: { xs: 'flex', md: 'none' } }}>
            {rows.length ? (
              rows.map((r) => (
                <InvoiceMobileCard
                  key={r.id}
                  row={r}
                  downloading={pdfLoadingId === r.id}
                  onOpen={() => setSelected(r)}
                  onDownload={() => void downloadInvoicePdf(r)}
                />
              ))
            ) : (
              <Alert severity="info" sx={{ borderRadius: 3 }}>
                {loading ? 'Loading invoices…' : 'No invoices match your filters.'}
              </Alert>
            )}
          </Stack>

          <Box sx={{ height: 620, width: '100%', display: { xs: 'none', md: 'block' } }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              pageSizeOptions={[25, 50, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              disableRowSelectionOnClick
              onRowClick={(p) => setSelected(p.row)}
              sx={{ border: 0 }}
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        fullWidth
        fullScreen={isMobile}
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
            overflow: 'hidden',
            maxHeight: isMobile ? '100%' : '92vh',
            m: isMobile ? 0 : 2,
          },
        }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: isMobile ? '100%' : 'auto', overflow: 'hidden' }}>
          {selected && (
            <InvoiceDetailPanel
              row={selected}
              onClose={() => setSelected(null)}
              downloading={pdfLoadingId === selected.id}
              onDownload={() => void downloadInvoicePdf(selected)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
