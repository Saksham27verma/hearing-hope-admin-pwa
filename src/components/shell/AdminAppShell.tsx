'use client';

import { useState, useEffect } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  Divider,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Menu as MenuIcon, Moon, Sun, LogOut, User } from 'lucide-react';
import SidebarNav, { SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED } from './SidebarNav';
import InstallPwaButton from './InstallPwaButton';
import NotificationsBell from './NotificationsBell';
import CenterScopePicker from './CenterScopePicker';
import MobileBottomNav from './MobileBottomNav';
import DashboardHeaderTitle from './DashboardHeaderTitle';
import HeaderActionButton from './HeaderActionButton';
import { headerActionSx, headerBarSx, headerMenuPaperSx, type HeaderChromeTone } from './headerUi';
import { useAdminTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { ADMIN_NAV_ITEMS } from './navConfig';
import { usePathname } from 'next/navigation';
import { HEADER_TOOLBAR_HEIGHT, shellAppBarSx, shellMainOffsetSx } from './shellLayout';

export default function AdminAppShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const pathname = usePathname();
  const { mode, toggleMode } = useAdminTheme();
  const { userProfile, signOut } = useAuth();
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const sync = () => {
      setIsDesktop(mq.matches);
      setSidebarOpen(mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const offsetLeft = isDesktop ? (sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_COLLAPSED) : 0;
  const activeItem = ADMIN_NAV_ITEMS.find((i) => pathname?.startsWith(i.path));
  const isDashboard = pathname === '/dashboard';
  const headerTone: HeaderChromeTone = isDashboard ? 'soft' : 'light';
  const initial =
    (userProfile?.displayName?.[0] || userProfile?.email?.[0] || 'A').toUpperCase();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop && <SidebarNav open={sidebarOpen} isDesktop={isDesktop} onClose={() => setSidebarOpen(false)} />}

      <AppBar
        className="hh-app-bar"
        position="fixed"
        elevation={0}
        sx={{
          left: offsetLeft,
          width: `calc(100% - ${offsetLeft}px)`,
          transition: 'left 0.28s cubic-bezier(0.4, 0, 0.2, 1), width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          ...shellAppBarSx,
          ...headerBarSx(theme, headerTone),
        }}
      >
        <Toolbar
          disableGutters={false}
          sx={{
            minHeight: { xs: 64, md: HEADER_TOOLBAR_HEIGHT },
            px: { xs: 1.5, md: 3 },
            gap: { xs: 0.75, md: 1 },
          }}
        >
          <IconButton
            onClick={() => setSidebarOpen((v) => !v)}
            size="small"
            sx={{
              mr: 0.5,
              display: { xs: 'none', md: 'inline-flex' },
              ...headerActionSx(theme, headerTone),
            }}
          >
            <MenuIcon size={20} />
          </IconButton>

          <Box sx={{ minWidth: 0 }}>
            {isDashboard ? (
              <DashboardHeaderTitle />
            ) : (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: { xs: 16, md: 18 }, lineHeight: 1.1 }}>
                  {activeItem?.text || 'Hope Admin'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                  Welcome back, {userProfile?.displayName || userProfile?.email || 'admin'}
                </Typography>
              </>
            )}
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <CenterScopePicker tone={headerTone} />
          </Box>

          <InstallPwaButton />

          <HeaderActionButton title={mode === 'light' ? 'Switch to dark' : 'Switch to light'} tone={headerTone} onClick={toggleMode}>
            {mode === 'light' ? <Moon size={19} strokeWidth={2.25} /> : <Sun size={19} strokeWidth={2.25} />}
          </HeaderActionButton>

          <NotificationsBell tone={headerTone} />

          <HeaderActionButton title="Account" tone={headerTone} onClick={(e) => setProfileAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                fontSize: 13,
                fontWeight: 800,
                bgcolor: 'transparent',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                border: `2px solid ${alpha(theme.palette.primary.light, headerTone === 'dark' ? 0.55 : 0.35)}`,
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
              }}
            >
              {initial}
            </Avatar>
          </HeaderActionButton>

          <Menu
            anchorEl={profileAnchor}
            open={!!profileAnchor}
            onClose={() => setProfileAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { ...headerMenuPaperSx(theme), minWidth: 260 } } }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.75,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 65%)`,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    fontWeight: 800,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  }}
                >
                  {initial}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
                    {userProfile?.displayName || userProfile?.email}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {userProfile?.isSuperAdmin ? 'Super-admin' : 'Admin'}
                  </Typography>
                </Box>
              </Stack>
            </Box>
            <Divider />
            <MenuItem onClick={() => setProfileAnchor(null)} sx={{ py: 1.25, fontWeight: 600 }}>
              <User size={16} style={{ marginRight: 10 }} />
              Profile (CRM)
            </MenuItem>
            <MenuItem
              onClick={async () => {
                setProfileAnchor(null);
                await signOut();
              }}
              sx={{ py: 1.25, fontWeight: 600, color: 'error.main' }}
            >
              <LogOut size={16} style={{ marginRight: 10 }} />
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flex: 1,
          ml: `${offsetLeft}px`,
          ...shellMainOffsetSx,
          transition: 'margin-left 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          p: { xs: 1.5, md: 3 },
          maxWidth: '100%',
          overflowX: 'hidden',
        }}
      >
        {children}
      </Box>
      <MobileBottomNav />
    </Box>
  );
}
