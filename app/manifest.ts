import type { MetadataRoute } from 'next';
import { PRIMARY_ORANGE } from '@/theme/theme';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hope Admin — Hearing Hope',
    short_name: 'Hope Admin',
    description:
      'Centralized control panel for the Hearing Hope ecosystem: sales, calls, appointments, audit and reports in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0b10',
    theme_color: PRIMARY_ORANGE,
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
