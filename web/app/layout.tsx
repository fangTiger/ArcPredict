import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ArcBackground } from '@/components/ArcBackground';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ArcPredict',
  description: 'Trade prediction markets on Arc with USDC.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-canvas text-ink antialiased">
        <ArcBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
