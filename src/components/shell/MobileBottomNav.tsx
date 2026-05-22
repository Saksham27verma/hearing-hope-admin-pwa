'use client';

import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { usePathname, useRouter } from 'next/navigation';
import { ADMIN_NAV_ITEMS } from './navConfig';

const PRIMARY_MOBILE_ITEMS = ['/dashboard', '/sales', '/calls', '/inventory', '/reports'];

export default function MobileBottomNav() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
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
        bottom: 'calc(env(safe-area-inset-bottom) + 10px)',
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
          height: 66,
          bgcolor: 'transparent',
          '& .MuiBottomNavigationAction-root': { minWidth: 0, px: 0.5 },
          '& .MuiBottomNavigationAction-label': { fontSize: 10.5, fontWeight: 700 },
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return <BottomNavigationAction key={item.path} value={item.path} label={item.text.replace(' & Financials', '')} icon={<Icon size={20} />} />;
        })}
      </BottomNavigation>
    </Paper>
  );
}
