'use client';

import { Badge, Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { usePathname, useRouter } from 'next/navigation';
import { ADMIN_NAV_ITEMS } from './navConfig';
import { usePendingWhatsAppApprovalCount } from '@/hooks/usePendingWhatsAppApprovalCount';
import { MOBILE_BOTTOM_NAV_HEIGHT } from './shellLayout';

const PRIMARY_MOBILE_ITEMS = [
  '/dashboard',
  '/sales',
  '/whatsapp-approvals',
  '/calls',
  '/appointments',
];

function mobileNavLabel(path: string, text: string) {
  if (path === '/whatsapp-approvals') return 'WhatsApp';
  return text.replace(' & Financials', '');
}

export default function MobileBottomNav() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { count: pendingWaCount } = usePendingWhatsAppApprovalCount();
  const items = ADMIN_NAV_ITEMS.filter((item) => PRIMARY_MOBILE_ITEMS.includes(item.path));
  const active = items.find((item) => pathname === item.path || pathname?.startsWith(item.path + '/'))?.path || '/dashboard';

  return (
    <Paper
      elevation={10}
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        left: 10,
        right: 10,
        bottom: 'calc(var(--hh-mobile-nav-gap) + var(--hh-safe-bottom))',
        zIndex: 1300,
        borderRadius: 5,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.94 : 0.86),
        backdropFilter: 'blur(16px)',
      }}
    >
      <BottomNavigation
        showLabels
        value={active}
        onChange={(_event, value) => router.push(value)}
        sx={{
          height: MOBILE_BOTTOM_NAV_HEIGHT,
          bgcolor: 'transparent',
          '& .MuiBottomNavigationAction-root': { minWidth: 0, px: 0.5 },
          '& .MuiBottomNavigationAction-label': { fontSize: 10.5, fontWeight: 700 },
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const icon =
            item.path === '/whatsapp-approvals' ? (
              <Badge badgeContent={pendingWaCount} color="error" invisible={pendingWaCount === 0} max={99}>
                <Icon size={20} />
              </Badge>
            ) : (
              <Icon size={20} />
            );
          return (
            <BottomNavigationAction
              key={item.path}
              value={item.path}
              label={mobileNavLabel(item.path, item.text)}
              icon={icon}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
