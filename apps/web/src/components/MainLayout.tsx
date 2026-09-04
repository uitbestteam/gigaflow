import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { PageTransition } from './motion';

export interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Mobile-first app frame: a centered phone-width column with a glassy sticky
 * header, a scrollable page area (re-animated on every route change via the
 * keyed `PageTransition`), and a glassy bottom tab bar for primary nav.
 */
export function MainLayout({ children }: MainLayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg text-text">
      <AppHeader />
      <main className="app-container flex-1 px-4 pb-24 pt-4">
        <PageTransition key={pathname}>{children}</PageTransition>
      </main>
      <BottomNav />
    </div>
  );
}
