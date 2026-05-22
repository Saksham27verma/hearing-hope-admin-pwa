import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import ClientProviders from './ClientProviders';
import { PRIMARY_ORANGE } from '@/theme/theme';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Hope Admin — Hearing Hope',
  description:
    'Centralized admin control panel for the Hearing Hope ecosystem — CRM, PWAs, and mobile apps in a single, unified dashboard.',
  applicationName: 'Hope Admin',
  appleWebApp: {
    capable: true,
    /* default keeps status bar readable; header uses safe-area padding for notch / Dynamic Island */
    statusBarStyle: 'default',
    title: 'Hope Admin',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: PRIMARY_ORANGE,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable} style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
