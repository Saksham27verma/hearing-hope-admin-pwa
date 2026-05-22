'use client';

import { useMemo } from 'react';
import { FormControl, MenuItem, Select, Chip, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Building2 } from 'lucide-react';
import { useCenterScope } from '@/lib/hooks/useCenterScope';
import { useCollection } from '@/lib/hooks/useCollection';
import { COLLECTIONS, type CenterDoc } from '@/lib/firestore/queries';
import type { HeaderChromeTone } from './headerUi';

export default function CenterScopePicker({ tone = 'light' }: { tone?: HeaderChromeTone }) {
  const theme = useTheme();
  const isDark = tone === 'dark';
  const isSoft = tone === 'soft';
  const { effectiveCenterId, setEffectiveCenterId, allowedCenterIds, canSelectGlobal, lockedCenterId } =
    useCenterScope();
  const { data: centers } = useCollection<CenterDoc>(COLLECTIONS.centers);

  const options = useMemo(() => {
    const list = centers.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (allowedCenterIds && allowedCenterIds.length > 0) {
      return list.filter((c) => allowedCenterIds.includes(c.id));
    }
    return list;
  }, [centers, allowedCenterIds]);

  const currentName = useMemo(() => {
    if (!effectiveCenterId) return 'All centers';
    return centers.find((c) => c.id === effectiveCenterId)?.name || effectiveCenterId;
  }, [effectiveCenterId, centers]);

  if (lockedCenterId) {
    return (
      <Tooltip title="Your account is locked to this center">
        <Chip
          icon={<Building2 size={14} />}
          label={currentName}
          size="small"
          variant="outlined"
          sx={{
            height: 36,
            borderRadius: 1.25,
            px: 0.5,
            fontWeight: 600,
            borderColor: isDark ? alpha('#fff', 0.2) : alpha(theme.palette.primary.main, isSoft ? 0.25 : 0.4),
            bgcolor: isDark ? alpha('#fff', 0.06) : isSoft ? alpha('#fff', 0.7) : undefined,
            color: isDark ? '#fff' : 'primary.main',
          }}
        />
      </Tooltip>
    );
  }

  return (
    <FormControl size="small">
      <Select
        value={effectiveCenterId ?? ''}
        displayEmpty
        onChange={(e) => setEffectiveCenterId(e.target.value ? String(e.target.value) : null)}
        startAdornment={
          <Building2
            size={16}
            style={{
              marginRight: 6,
              color: isDark ? alpha('#fff', 0.7) : theme.palette.text.secondary,
            }}
          />
        }
        sx={{
          minWidth: 180,
          height: 40,
          borderRadius: 1.25,
          fontWeight: 600,
          color: isDark ? '#fff' : 'inherit',
          bgcolor: isDark
            ? alpha('#fff', 0.06)
            : isSoft
              ? alpha('#fff', 0.75)
              : alpha(theme.palette.primary.main, 0.04),
          border: `1px solid ${
            isDark ? alpha('#fff', 0.14) : isSoft ? alpha('#0f172a', 0.08) : alpha(theme.palette.divider, 0.9)
          }`,
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover': {
            bgcolor: isDark ? alpha('#fff', 0.1) : alpha(theme.palette.primary.main, 0.08),
          },
          '& .MuiSelect-select': { display: 'flex', alignItems: 'center' },
          '& .MuiSvgIcon-root': { color: isDark ? alpha('#fff', 0.75) : 'inherit' },
        }}
      >
        {canSelectGlobal && <MenuItem value="">All centers (global)</MenuItem>}
        {options.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name || c.id}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
