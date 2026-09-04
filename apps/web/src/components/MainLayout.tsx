import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { PageTransition } from './motion';

export interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Mobile-first app-shell frame. The shell fills exactly one dynamic viewport
 * (`100dvh`) and never scrolls itself — the header and bottom nav are a fixed
 * frame, and ONLY the middle `<main>` scrolls. This avoids the mobile/PWA
 * address-bar resize jumps and rubber-band bounce that a body-scroll + sticky
 * layout produces. Page content re-animates on every route change via the
 * keyed `PageTransition`.
 */
export function MainLayout({ children }: MainLayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg text-text">
      <AppHeader />
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="app-container px-4 pb-6 pt-4">
          <PageTransition key={pathname}>{children}</PageTransition>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
