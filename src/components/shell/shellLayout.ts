/** Toolbar row height (icons + title), excluding iOS safe-area inset */
export const HEADER_TOOLBAR_HEIGHT = 72;

/** Fixed mobile bottom navigation bar height (see MobileBottomNav). */
export const MOBILE_BOTTOM_NAV_HEIGHT = 66;

export const shellAppBarSx = {
  pt: 'var(--hh-safe-top)',
} as const;

export const shellMainOffsetSx = {
  mt: 'var(--hh-header-total)',
  minHeight: {
    xs: 'calc(100dvh - var(--hh-header-total) - var(--hh-mobile-nav-total))',
    md: 'calc(100dvh - var(--hh-header-total))',
  },
  pt: { xs: 1.5, md: 3 },
  px: { xs: 1.5, md: 3 },
  pb: {
    xs: 'calc(var(--hh-mobile-nav-total) + 1.5rem)',
    md: 3,
  },
  boxSizing: 'border-box',
} as const;

/** Extra clearance when a sticky footer sits above the mobile bottom nav. */
export const mobileStickyFooterSx = {
  position: 'sticky',
  bottom: { xs: 'var(--hh-mobile-nav-total)', md: 0 },
  zIndex: 2,
} as const;
