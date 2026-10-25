import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'KidHub', template: '%s · KidHub' },
  description: 'One app for childcare centers: attendance, daily reports, billing, messaging and live video.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2F6F5E' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
