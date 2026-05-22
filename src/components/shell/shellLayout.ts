/** Toolbar row height (icons + title), excluding iOS safe-area inset */
export const HEADER_TOOLBAR_HEIGHT = 72;

export const shellAppBarSx = {
  pt: 'var(--hh-safe-top)',
} as const;

export const shellMainOffsetSx = {
  mt: 'var(--hh-header-total)',
  minHeight: 'calc(100dvh - var(--hh-header-total))',
  pb: {
    xs: 'calc(5.5rem + var(--hh-safe-bottom))',
    md: 3,
  },
} as const;
