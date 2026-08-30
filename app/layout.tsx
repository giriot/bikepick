import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CompareTray } from '@/components/CompareTray';
import { getCurrentUser } from '@/lib/auth';
import { JsonLd, organizationJsonLd, siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Bikepick.IN — Compare Smart. Buy Better.',
    template: '%s | Bikepick.IN',
  },
  description:
    'Compare bikes, electric scooters and used bikes in India with structured specifications, verified dealer offers, running-cost maths and transparent scoring.',
  applicationName: 'Bikepick.IN',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png', sizes: '256x256' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
    shortcut: ['/icon.png'],
  },
  alternates: { canonical: '/' },
  twitter: {
    card: 'summary_large_image',
    title: 'Bikepick.IN — Compare Smart. Buy Better.',
    description: 'India’s structured two-wheeler comparison and buying platform.',
    images: ['/og-default.png'],
  },
  openGraph: {
    type: 'website', locale: 'en_IN', siteName: 'Bikepick.IN',
    title: 'Bikepick.IN — Compare Smart. Buy Better.',
    description: 'India’s structured two-wheeler comparison and buying platform.',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Bikepick.IN — Compare Smart. Buy Better.' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0D12',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en-IN">
      <body className="flex min-h-screen flex-col">
        <JsonLd data={organizationJsonLd()} />
        <Header user={user} />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
        <CompareTray />
      </body>
    </html>
  );
}
