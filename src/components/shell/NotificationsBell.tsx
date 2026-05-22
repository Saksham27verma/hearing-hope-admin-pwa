'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Popover,
  Typography,
  Stack,
  Chip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Bell } from 'lucide-react';
import { orderBy, limit } from 'firebase/firestore';
import { useCollection } from '@/lib/hooks/useCollection';
import { COLLECTIONS, type ActivityLogDoc } from '@/lib/firestore/queries';
import { formatDistanceToNow } from 'date-fns';
import { toDateSafe } from '@/lib/utils/dateRanges';
import HeaderActionButton from './HeaderActionButton';
import { headerMenuPaperSx, type HeaderChromeTone } from './headerUi';

const RECENT_LIMIT = 8;

export default function NotificationsBell({ tone = 'light' }: { tone?: HeaderChromeTone }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const { data: logs } = useCollection<ActivityLogDoc>(COLLECTIONS.activityLogs, [
    orderBy('timestamp', 'desc'),
    limit(RECENT_LIMIT),
  ]);

  const unread = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    return logs.filter((l) => {
      const t = toDateSafe(l.timestamp);
      return t && t.getTime() > cutoff;
    }).length;
  }, [logs]);

  return (
    <>
      <HeaderActionButton title="Recent activity" tone={tone} onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Badge
          badgeContent={unread}
          max={9}
          sx={{
            '& .MuiBadge-badge': {
              fontWeight: 800,
              fontSize: 10,
              minWidth: 18,
              height: 18,
              bgcolor: theme.palette.primary.main,
              color: '#fff',
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.45)}`,
            },
          }}
        >
          <Bell size={19} strokeWidth={2.25} />
        </Badge>
      </HeaderActionButton>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, mt: 1.25, ...headerMenuPaperSx(theme) } } }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.75,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 70%)`,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Recent activity</Typography>
            <Chip
              label={unread > 0 ? `${unread} new` : 'Up to date'}
              size="small"
              sx={{
                fontWeight: 700,
                height: 24,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                color: 'primary.main',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
              }}
            />
          </Stack>
        </Box>
        <Divider />
        <List sx={{ py: 0, maxHeight: 420, overflowY: 'auto' }}>
          {logs.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No activity yet.
              </Typography>
            </Box>
          )}
          {logs.map((l) => {
            const when = toDateSafe(l.timestamp);
            return (
              <ListItem
                key={l.id}
                alignItems="flex-start"
                sx={{
                  py: 1.25,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{l.userName || 'System'}</Typography>
                      <Chip label={l.action || '—'} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                      <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {when ? formatDistanceToNow(when, { addSuffix: true }) : ''}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {l.description || `${l.module ?? ''} ${l.entityName ?? ''}`}
                    </Typography>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </Popover>
    </>
  );
}
