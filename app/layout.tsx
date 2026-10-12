import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { NavRail } from '@/components/navigation/nav-rail';
import { TopBar } from '@/components/navigation/top-bar';
import { Providers } from '@/components/providers/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Eco Field Lab — Real Data. Real Decisions. Healthier Planets.', template: '%s · Eco Field Lab' },
  description:
    'An interactive ecology and statistics lab: sample simulated ecosystems with quadrats and transects, or analyse your own data with descriptive statistics, t-tests and chi-squared tests.',
  applicationName: 'Eco Field Lab',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#031926',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <div className="flex min-h-dvh">
            <NavRail />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main id="main" className="flex-1 pb-24 md:pb-10">
                {children}
              </main>
            </div>
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
