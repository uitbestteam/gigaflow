import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { useLocaleStore } from '../store/localeStore';
import { ROUTES } from '../routes';

export interface MainLayoutProps {
  children: ReactNode;
}

/** Dark app frame shared by every route: header with brand, language toggle, and account link. */
export function MainLayout({ children }: MainLayoutProps) {
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-3">
        <Link to={ROUTES.home} className="text-lg font-semibold">
          {t('common.appName')}
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle value={locale} onChange={setLocale} />
          <Link
            to={ROUTES.exercises}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] px-3 text-text-secondary"
          >
            {t('exercises.title')}
          </Link>
          <Link
            to={ROUTES.account}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] px-3 text-text-secondary"
          >
            {t('common.account')}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
