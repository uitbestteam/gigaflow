import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';

export interface AuthGateProps {
  children: ReactNode;
}

/**
 * Gates the app behind auth bootstrap: shows a branded splash while
 * `authStore.status === 'loading'`, a retry prompt on `'error'`, and
 * renders `children` for every other status (`'guest'` | `'user'`).
 */
export function AuthGate({ children }: AuthGateProps) {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  if (status === 'loading') {
    return (
      <div
        data-testid="auth-splash"
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-bg text-text"
      >
        <div className="animate-pulse-glow flex h-20 w-20 items-center justify-center rounded-xl bg-grad-primary text-2xl font-black text-white">
          GF
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          <span className="text-gradient">{t('common.appName')}</span>
        </h1>
        <div className="flex items-center gap-3 text-text-secondary">
          <Spinner label={t('auth.splashLabel')} />
          <p>{t('auth.splashLabel')}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-text">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2 text-3xl">😕</div>
        <p className="text-lg font-bold">{t('auth.errorTitle')}</p>
        <p className="text-text-secondary">{t('auth.errorBody')}</p>
        <Button size="lg" onClick={() => void bootstrap()}>
          {t('auth.retry')}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
