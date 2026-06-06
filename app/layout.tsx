import type { Metadata } from 'next';
import './globals.css';
import { LaunchSplash } from '@/components/LaunchSplash';

export const metadata: Metadata = {
  title: 'Altis · Weather-Aware Cashflow',
  description:
    'Weather-aware 13-week cashflow forecasting for a PE-backed roofing portfolio.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LaunchSplash />
        {children}
      </body>
    </html>
  );
}
