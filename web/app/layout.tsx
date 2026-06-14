import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ArcBackground } from '@/components/ArcBackground';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ArcPredict · 链上预测市场',
  description: '在 Arc 上用 USDC 参与预测市场。',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'ArcPredict',
    description: '在 Arc 上用 USDC 参与预测市场。',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArcPredict',
    description: '在 Arc 上用 USDC 参与预测市场。',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#050614',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-0 text-ink antialiased">
        <ArcBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
