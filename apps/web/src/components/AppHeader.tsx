import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { UserIcon } from './icons';
import { useLocaleStore } from '../store/localeStore';
import { ROUTES } from '../routes';

/** Compact glassy top bar: gradient wordmark + language toggle + account avatar. */
export function AppHeader() {
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <header className="glass safe-top sticky top-0 z-40 border-b border-border-subtle">
      <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3 px-4 py-3">
        <Link to={ROUTES.home} className="text-xl font-extrabold tracking-tight">
          <span className="text-gradient">{t('common.appName')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle value={locale} onChange={setLocale} />
          <Link
            to={ROUTES.account}
            aria-label={t('common.account')}
            className="flex h-10 w-10 items-center justify-center rounded-pill border border-border bg-surface-2 text-text-secondary transition-colors hover:text-text"
          >
            <UserIcon width={20} height={20} />
          </Link>
        </div>
      </div>
    </header>
  );
}
