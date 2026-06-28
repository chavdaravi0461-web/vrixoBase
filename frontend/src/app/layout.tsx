import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const url = 'https://vrixo-base-frontend.vercel.app';

export const metadata: Metadata = {
  title: {
    default: 'VrixoBase - Backend Infrastructure Platform',
    template: '%s | VrixoBase',
  },
  description:
    'Build and scale your applications with VrixoBase - Database, API, Storage, Realtime, and Functions.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'VrixoBase - Backend Infrastructure Platform',
    description:
      'Build and scale your applications with VrixoBase - Database, API, Storage, Realtime, and Functions.',
    url,
    siteName: 'VrixoBase',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VrixoBase - Backend Infrastructure Platform',
    description:
      'Build and scale your applications with VrixoBase - Database, API, Storage, Realtime, and Functions.',
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL(url),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
