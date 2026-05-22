'use client';

import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography, Chip, Stack } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { ADMIN_NAV_ITEMS } from './navConfig';

export const SIDEBAR_WIDTH = 264;
export const SIDEBAR_WIDTH_COLLAPSED = 76;

interface SidebarNavProps {
  open: boolean;
  isDesktop: boolean;
  onClose: () => void;
}

/**
 * Collapsible primary navigation. On desktop the drawer is always present
 * and toggles between an icon-rail and the full-width sidebar. On mobile it
 * behaves as a temporary drawer.
 */
export default function SidebarNav({ open, isDesktop, onClose }: SidebarNavProps) {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const width = open ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_COLLAPSED;

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        width: isDesktop ? width : SIDEBAR_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: `1px solid ${theme.palette.divider}`,
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 2.25,
          minHeight: 72,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            boxShadow: `0 10px 20px ${alpha(theme.palette.primary.main, 0.35)}`,
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={20} />
        </Box>
        {(open || !isDesktop) && (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>Hope Admin</Typography>
            <Typography variant="caption" color="text.secondary">
              Hearing Hope Control
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ flex: 1, py: 1.5, overflowY: 'auto' }}>
        <List sx={{ px: 1 }}>
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.path || (pathname?.startsWith(item.path + '/') ?? false);
            return (
              <ListItemButton
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                  if (!isDesktop) onClose();
                }}
                selected={active}
                sx={{
                  mb: 0.5,
                  borderRadius: 10,
                  px: 1.5,
                  py: 1,
                  minHeight: 46,
                  color: active ? 'primary.main' : 'text.primary',
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.1 : 0.18),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.14 : 0.24),
                    },
                  },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                  },
                  justifyContent: open || !isDesktop ? 'flex-start' : 'center',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open || !isDesktop ? 1.5 : 0,
                    color: active ? 'primary.main' : 'text.secondary',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                </ListItemIcon>
                {(open || !isDesktop) && (
                  <>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{ fontWeight: active ? 600 : 500, fontSize: 14.5 }}
                    />
                    {item.badge && (
                      <Chip
                        label={item.badge}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10.5,
                          fontWeight: 600,
                          bgcolor: alpha(theme.palette.primary.main, 0.14),
                          color: theme.palette.primary.main,
                        }}
                      />
                    )}
                  </>
                )}
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {(open || !isDesktop) && (
        <Box sx={{ px: 2, py: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              All systems operational
            </Typography>
          </Stack>
        </Box>
      )}
    </Box>
  );

  if (isDesktop) {
    return (
      <Box
        component="aside"
        sx={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1200,
          width,
          transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {drawerContent}
      </Box>
    );
  }

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{ sx: { width: SIDEBAR_WIDTH, border: 'none' } }}
    >
      {drawerContent}
    </Drawer>
  );
}
