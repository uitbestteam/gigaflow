import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { ComponentType, SVGProps } from 'react';
import { ROUTES } from '../routes';
import { HomeIcon, ListIcon, SparklesIcon, UtensilsIcon, ChartIcon } from './icons';

type Tab = {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  center?: boolean;
};

/**
 * Mobile-first primary navigation: a glassy bottom tab bar with an elevated
 * gradient center CTA (AI generate). The active tab shows an animated pill via
 * a shared `layoutId`. Secondary destinations (exercises, InBody, account) live
 * on the Account hub, reachable from the header avatar.
 */
export function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const tabs: Tab[] = [
    { to: ROUTES.home, label: t('nav.home'), Icon: HomeIcon },
    { to: ROUTES.plans, label: t('nav.plans'), Icon: ListIcon },
    { to: ROUTES.generate, label: t('nav.generate'), Icon: SparklesIcon, center: true },
    { to: ROUTES.meal, label: t('nav.meal'), Icon: UtensilsIcon },
    { to: ROUTES.stats, label: t('nav.stats'), Icon: ChartIcon },
  ];

  const isActive = (to: string) => (to === ROUTES.home ? pathname === to : pathname.startsWith(to));

  return (
    <nav className="glass safe-bottom sticky bottom-0 z-40 border-t border-border-subtle shadow-nav">
      <ul className="mx-auto flex max-w-[520px] items-stretch justify-between px-2">
        {tabs.map(({ to, label, Icon, center }) => {
          const active = isActive(to);

          if (center) {
            return (
              <li key={to} className="flex flex-1 items-center justify-center">
                <Link
                  to={to}
                  aria-label={label}
                  className="-mt-6 flex h-14 w-14 items-center justify-center rounded-pill bg-grad-primary text-white shadow-glow-accent transition-transform active:scale-95"
                >
                  <Icon width={26} height={26} />
                </Link>
              </li>
            );
          }

          return (
            <li key={to} className="flex flex-1">
              <Link
                to={to}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-x-3 top-1 h-1 rounded-pill bg-grad-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )}
                <Icon
                  width={23}
                  height={23}
                  className={active ? 'text-neon-violet' : 'text-text-muted'}
                />
                <span
                  className={`text-[11px] font-semibold ${active ? 'text-text' : 'text-text-muted'}`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
