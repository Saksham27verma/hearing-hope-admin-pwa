'use client';

import { useMemo, useState } from 'react';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { groupSalesRows, type GroupedSalesRow } from '@/lib/reports/sales';
import type { NormalizedSaleRow } from '@/lib/reports/sales';
import { formatINR } from '@/lib/utils/dateRanges';
import { dashboardCardSx } from './dashboardUi';

const DASHBOARD_SALES_VIEWS = ['center', 'executive', 'source', 'week'] as const;
type DashboardSalesView = (typeof DASHBOARD_SALES_VIEWS)[number];

const VIEW_LABELS: Record<DashboardSalesView, string> = {
  center: 'Center',
  executive: 'Executive',
  source: 'Source',
  week: 'Week',
};

function reportsSalesLink(view: DashboardSalesView) {
  return `/reports?report=Sales&view=${view}`;
}

function compactSaleLabel(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return `₹${Math.round(n)}`;
}

function BarEndLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  chartData,
  fill,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  chartData: GroupedSalesRow[];
  fill: string;
}) {
  const row = chartData[index];
  if (!row) return null;
  return (
    <text x={x + width + 6} y={y + height / 2} dy={4} fill={fill} fontSize={10} fontWeight={700}>
      {compactSaleLabel(row.sales)}
    </text>
  );
}

interface CenterWiseSalesChartProps {
  rows: NormalizedSaleRow[];
  periodLabel: string;
}

export default function CenterWiseSalesChart({ rows, periodLabel }: CenterWiseSalesChartProps) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;
  /** High-contrast vs orange bars — indigo reads clearly on light backgrounds */
  const lineColor = theme.palette.mode === 'dark' ? '#818CF8' : '#4338CA';
  const [salesView, setSalesView] = useState<DashboardSalesView>('center');

  const chartData = useMemo(() => groupSalesRows(rows, salesView).slice(0, 8), [rows, salesView]);
  const total = useMemo(() => chartData.reduce((sum, d) => sum + d.sales, 0), [chartData]);
  const maxDiscPct = useMemo(
    () => Math.max(8, ...chartData.map((d) => d.avgDiscountPct), 0),
    [chartData],
  );
  const yAxisWidth = salesView === 'week' ? 118 : salesView === 'source' || salesView === 'executive' ? 96 : 88;
  const labelFill = theme.palette.text.primary;

  return (
    <Card variant="outlined" sx={{ ...dashboardCardSx(theme, accent), overflow: 'hidden' }}>
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
                bgcolor: alpha(accent, 0.12),
                color: accent,
              }}
            >
              <BarChart3 size={15} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                {VIEW_LABELS[salesView]}-wise sales
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {periodLabel}
                {total > 0 ? ` · ${formatINR(total)}` : ''}
              </Typography>
            </Box>
          </Stack>
          <Box
            component={Link}
            href={reportsSalesLink(salesView)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              fontSize: 12,
              fontWeight: 700,
              color: 'primary.main',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            CRM Reports
            <ChevronRight size={16} />
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            mb: 0.75,
            overflowX: 'auto',
            pb: 0.25,
            flexWrap: 'nowrap',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {DASHBOARD_SALES_VIEWS.map((view) => (
            <Chip
              key={view}
              clickable
              size="small"
              label={VIEW_LABELS[view]}
              color={salesView === view ? 'primary' : 'default'}
              variant={salesView === view ? 'filled' : 'outlined'}
              onClick={() => setSalesView(view)}
              sx={{ fontWeight: 700, flexShrink: 0, height: 26 }}
            />
          ))}
        </Stack>

        {chartData.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center', fontSize: 13 }}>
            No sales in this period for {VIEW_LABELS[salesView].toLowerCase()}.
          </Typography>
        ) : (
          <Box sx={{ height: 220, mx: -0.5 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} layout="vertical" margin={{ top: 12, right: 52, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.8)} horizontal={false} />
                <XAxis
                  xAxisId="sales"
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <XAxis
                  xAxisId="disc"
                  type="number"
                  orientation="top"
                  domain={[0, Math.ceil(maxDiscPct * 1.15)]}
                  tick={{ fontSize: 10, fill: lineColor }}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  width={yAxisWidth}
                  dataKey="name"
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingBottom: 2 }}
                  formatter={(value) => (value === 'sales' ? 'Net sales' : 'Discount %')}
                />
                <ChartTooltip
                  cursor={{ fill: alpha(accent, 0.06) }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as GroupedSalesRow;
                    return (
                      <Box
                        sx={{
                          px: 1.25,
                          py: 1,
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                          border: `1px solid ${theme.palette.divider}`,
                          boxShadow: 2,
                          fontSize: 12,
                        }}
                      >
                        <Typography sx={{ fontWeight: 800, fontSize: 12, mb: 0.5 }}>{d.name}</Typography>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: accent }}>
                          Sales: {formatINR(d.sales)}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: lineColor }}>
                          Discount: {d.avgDiscountPct > 0 ? `${d.avgDiscountPct.toFixed(1)}%` : '—'}
                          {d.discount > 0 ? ` (${formatINR(d.discount)})` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                          {d.invoices} invoice{d.invoices === 1 ? '' : 's'}
                        </Typography>
                      </Box>
                    );
                  }}
                />
                <Bar
                  xAxisId="sales"
                  dataKey="sales"
                  name="sales"
                  fill={accent}
                  maxBarSize={18}
                  radius={[0, 6, 6, 0]}
                >
                  <LabelList
                    content={(props) => <BarEndLabel {...props} chartData={chartData} fill={labelFill} />}
                  />
                </Bar>
                <Line
                  xAxisId="disc"
                  type="monotone"
                  dataKey="avgDiscountPct"
                  name="avgDiscountPct"
                  stroke={lineColor}
                  strokeWidth={3}
                  dot={{ r: 4, fill: lineColor, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: lineColor, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
