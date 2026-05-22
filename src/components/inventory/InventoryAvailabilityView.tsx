'use client';

import { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Collapse, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { orderBy } from 'firebase/firestore';
import { Building2, ChevronDown, ChevronUp, Factory, Layers3, MapPin, PackageCheck, Search } from 'lucide-react';
import KpiCard from '@/components/dashboard/KpiCard';
import { useCollection } from '@/lib/hooks/useCollection';
import { useCenterScope } from '@/lib/hooks/useCenterScope';
import { COLLECTIONS, type CenterDoc, type EnquiryDoc, type ProductDoc, type SaleDoc } from '@/lib/firestore/queries';
import { buildInventorySnapshot } from '@/lib/reports/inventory';
import { inventoryItemMatchesDataScope } from '@/lib/tenant/centerScope';
import { formatINR, formatNumber } from '@/lib/utils/dateRanges';

type AnyObj = Record<string, unknown>;

export default function InventoryAvailabilityView() {
  const { effectiveCenterId, allowedCenterIds } = useCenterScope();
  const [company, setCompany] = useState('all');
  const [center, setCenter] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const { data: products } = useCollection<ProductDoc>(COLLECTIONS.products);
  const { data: centers } = useCollection<CenterDoc>(COLLECTIONS.centers);
  const { data: materialInward } = useCollection<AnyObj>(COLLECTIONS.materialInward, [orderBy('createdAt', 'desc')]);
  const { data: purchases } = useCollection<AnyObj>(COLLECTIONS.purchases, [orderBy('createdAt', 'desc')]);
  const { data: materialsOut } = useCollection<AnyObj>(COLLECTIONS.materialsOut, [orderBy('createdAt', 'desc')]);
  const { data: sales } = useCollection<SaleDoc>(COLLECTIONS.sales, [orderBy('createdAt', 'desc')]);
  const { data: enquiries } = useCollection<EnquiryDoc>(COLLECTIONS.enquiries, [orderBy('createdAt', 'desc')]);
  const { data: staffCustody } = useCollection<AnyObj>(COLLECTIONS.staffTrialCustody, [orderBy('createdAt', 'desc')]);

  const snapshot = useMemo(
    () => buildInventorySnapshot(
      products as unknown as AnyObj[],
      materialInward,
      purchases,
      materialsOut,
      sales as unknown as AnyObj[],
      enquiries as unknown as AnyObj[],
      staffCustody,
      centers,
    ),
    [products, materialInward, purchases, materialsOut, sales, enquiries, staffCustody, centers],
  );

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return snapshot
      .filter((r) => inventoryItemMatchesDataScope(r.centerId, effectiveCenterId, allowedCenterIds))
      .filter((r) => r.available > 0)
      .filter((r) => company === 'all' || r.company === company)
      .filter((r) => center === 'all' || r.centerId === center)
      .filter((r) => category === 'all' || r.category === category)
      .filter((r) => !q || `${r.productName} ${r.serial || ''} ${r.centerName} ${r.company} ${r.category}`.toLowerCase().includes(q))
      .sort((a, b) => b.available - a.available || a.productName.localeCompare(b.productName));
  }, [snapshot, effectiveCenterId, allowedCenterIds, company, center, category, search]);

  const scopedSnapshot = useMemo(() => {
    const q = search.toLowerCase().trim();
    return snapshot
      .filter((r) => inventoryItemMatchesDataScope(r.centerId, effectiveCenterId, allowedCenterIds))
      .filter((r) => company === 'all' || r.company === company)
      .filter((r) => center === 'all' || r.centerId === center)
      .filter((r) => category === 'all' || r.category === category)
      .filter((r) => !q || `${r.productName} ${r.serial || ''} ${r.centerName} ${r.company} ${r.category}`.toLowerCase().includes(q));
  }, [snapshot, effectiveCenterId, allowedCenterIds, company, center, category, search]);

  const companies = useMemo(() => [...new Set(snapshot.map((r) => r.company).filter(Boolean))].sort(), [snapshot]);
  const centersInRows = useMemo(() => [...new Map(snapshot.map((r) => [r.centerId, r.centerName])).entries()], [snapshot]);
  const categories = useMemo(() => [...new Set(snapshot.map((r) => r.category).filter(Boolean))].sort(), [snapshot]);
  const totalRecords = scopedSnapshot.length;
  const available = rows.reduce((s, r) => s + r.available, 0);
  const sold = scopedSnapshot.reduce((s, r) => s + r.sold, 0);
  const value = rows.reduce((s, r) => s + r.value, 0);
  const productGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      productName: string;
      category: string;
      company: string;
      available: number;
      value: number;
      centers: Map<string, number>;
      details: typeof rows;
    }>();
    for (const row of rows) {
      const key = `${row.productId}|${row.company}|${row.category}`;
      const entry = map.get(key) || {
        key,
        productName: row.productName,
        category: row.category,
        company: row.company,
        available: 0,
        value: 0,
        centers: new Map<string, number>(),
        details: [],
      };
      entry.available += row.available;
      entry.value += row.value;
      entry.centers.set(row.centerName, (entry.centers.get(row.centerName) || 0) + row.available);
      entry.details.push(row);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.available - a.available || a.productName.localeCompare(b.productName));
  }, [rows]);

  const byCenter = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; inStock: number; sold: number; value: number }>();
    for (const row of scopedSnapshot) {
      const entry = map.get(row.centerId) || { id: row.centerId, name: row.centerName, total: 0, inStock: 0, sold: 0, value: 0 };
      entry.total += 1;
      entry.inStock += row.available;
      entry.sold += row.sold;
      entry.value += row.available > 0 ? row.value : 0;
      map.set(row.centerId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.inStock - a.inStock);
  }, [scopedSnapshot]);

  const maxCenterStock = Math.max(1, ...byCenter.map((c) => c.inStock));

  const byCompany = useMemo(() => {
    const map = new Map<string, { name: string; total: number; inStock: number; sold: number; value: number }>();
    for (const row of scopedSnapshot) {
      const entry = map.get(row.company) || { name: row.company || 'Unknown', total: 0, inStock: 0, sold: 0, value: 0 };
      entry.total += 1;
      entry.inStock += row.available;
      entry.sold += row.sold;
      entry.value += row.available > 0 ? row.value : 0;
      map.set(row.company, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.inStock - a.inStock);
  }, [scopedSnapshot]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; count: number; value: number; products: typeof productGroups }>();
    for (const group of productGroups) {
      const entry = map.get(group.category) || { name: group.category, count: 0, value: 0, products: [] };
      entry.count += group.available;
      entry.value += group.value;
      entry.products.push(group);
      map.set(group.category, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [productGroups]);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: 25, md: 34 } }}>Stock Analytics</Typography>
        <Typography color="text.secondary">CRM-style stock analytics: live in-stock quantity by center, company, and product category.</Typography>
      </Box>

      <Grid container spacing={1.5}>
        <Grid item xs={6} md={2.4}><KpiCard title="Total Records" value={formatNumber(totalRecords)} subtitle="CRM analytics rows" icon={Layers3} tone="info" /></Grid>
        <Grid item xs={6} md={2.4}><KpiCard title="In Stock" value={formatNumber(available)} subtitle="Sellable units" icon={PackageCheck} /></Grid>
        <Grid item xs={6} md={2.4}><KpiCard title="Sold" value={formatNumber(sold)} subtitle="Excluded from stock" icon={PackageCheck} tone="warning" /></Grid>
        <Grid item xs={6} md={2.4}><KpiCard title="Products" value={formatNumber(productGroups.length)} subtitle="Grouped view" icon={Layers3} tone="info" /></Grid>
        <Grid item xs={12} md={2.4}><KpiCard title="Dealer Value" value={formatINR(value)} subtitle="In-stock value" icon={Building2} tone="success" /></Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={1.2}>
            <TextField size="small" label="Search product / serial" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search size={16} style={{ marginRight: 8 }} /> }} sx={{ flex: 1 }} />
            <TextField select size="small" label="Company" value={company} onChange={(e) => setCompany(e.target.value)} sx={{ minWidth: 170 }}>
              <MenuItem value="all">All companies</MenuItem>
              {companies.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 160 }}>
              <MenuItem value="all">All categories</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Center" value={center} onChange={(e) => setCenter(e.target.value)} sx={{ minWidth: 170 }}>
              <MenuItem value="all">All centers</MenuItem>
              {centersInRows.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Stack spacing={1.2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <MapPin size={18} />
              <Typography fontWeight={800}>Center Heatmap</Typography>
            </Stack>
            {byCenter.map((r) => (
              <Card key={r.id} variant="outlined">
                <CardContent sx={{ py: 1.4 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                    <Box>
                      <Typography fontWeight={800}>{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.total} total • Sold {r.sold}</Typography>
                    </Box>
                    <Box textAlign="right">
                      <Typography fontWeight={900}>{r.inStock}</Typography>
                      <Typography variant="caption">{formatINR(r.value)}</Typography>
                    </Box>
                  </Stack>
                  <LinearProgress variant="determinate" value={(r.inStock / maxCenterStock) * 100} sx={{ mt: 1.2, height: 8, borderRadius: 8 }} />
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>

        <Grid item xs={12}>
          <Stack spacing={1.2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Factory size={18} />
              <Typography fontWeight={800}>Stock Position by Company</Typography>
            </Stack>
            <Grid container spacing={1.2}>
              {byCompany.map((r) => (
                <Grid item xs={12} sm={6} md={4} key={r.name}>
                  <Card variant="outlined" onClick={() => setCompany(company === r.name ? 'all' : r.name)} sx={{ cursor: 'pointer', borderColor: company === r.name ? 'primary.main' : 'divider' }}>
                    <CardContent sx={{ py: 1.4 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Box>
                          <Typography fontWeight={900}>{r.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.total} total rows</Typography>
                        </Box>
                        <Chip label={`${r.inStock} in stock`} color="success" size="small" />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                        <Typography variant="caption">Sold {r.sold}</Typography>
                        <Typography variant="caption" fontWeight={800}>{formatINR(r.value)}</Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Grid>

        <Grid item xs={12}>
          <Stack spacing={1.2}>
            <Typography fontWeight={800}>Stock by Category</Typography>
            <Grid container spacing={1.2}>
              {byCategory.map((r) => (
                <Grid item xs={12} sm={6} md={4} key={r.name}>
                  <Card variant="outlined" onClick={() => setCategory(category === r.name ? 'all' : r.name)} sx={{ cursor: 'pointer', borderColor: category === r.name ? 'primary.main' : 'divider' }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography fontWeight={900}>{r.name}</Typography>
                        <Chip size="small" color="success" variant="outlined" label={`${r.count} items`} />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                        <Typography variant="caption">Dealer value</Typography>
                        <Typography variant="caption" fontWeight={900}>{formatINR(r.value)}</Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Grid>

        <Grid item xs={12}>
          <Stack spacing={1.2}>
            <Typography fontWeight={800}>Products in stock</Typography>
            {productGroups.slice(0, 150).map((group) => {
              const expanded = expandedProduct === group.key;
              return (
              <Card key={group.key} variant="outlined">
                <CardContent sx={{ py: 1.4 }}>
                  <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={900} noWrap>{group.productName}</Typography>
                      <Typography variant="caption" color="text.secondary">{group.company} • {group.category}</Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.6} sx={{ mt: 1 }}>
                        {Array.from(group.centers.entries()).slice(0, 4).map(([name, qty]) => (
                          <Chip key={name} size="small" label={`${name}: ${qty}`} />
                        ))}
                      </Stack>
                    </Box>
                    <Box textAlign="right">
                      <Typography fontWeight={900} fontSize={24}>{group.available}</Typography>
                      <Typography variant="caption" color="text.secondary">qty</Typography>
                    </Box>
                  </Stack>
                  <Button
                    size="small"
                    endIcon={expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    onClick={() => setExpandedProduct(expanded ? null : group.key)}
                    sx={{ mt: 1 }}
                  >
                    {expanded ? 'Hide details' : 'View details'}
                  </Button>
                  <Collapse in={expanded} unmountOnExit>
                    <Stack spacing={0.8} sx={{ mt: 1 }}>
                      {group.details.map((detail) => (
                        <Box
                          key={detail.id}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 1,
                            px: 1.2,
                            py: 0.8,
                            borderRadius: 2,
                            bgcolor: 'action.hover',
                          }}
                        >
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{detail.centerName}</Typography>
                            {detail.serial && <Typography variant="caption">Serial: {detail.serial}</Typography>}
                          </Box>
                          <Typography fontWeight={900}>{detail.available}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Collapse>
                </CardContent>
              </Card>
            )})}
            {productGroups.length === 0 && <Card variant="outlined"><CardContent><Typography color="text.secondary">No available stock matches the selected filters.</Typography></CardContent></Card>}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
