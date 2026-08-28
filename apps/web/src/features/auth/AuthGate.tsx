import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';

export interface AuthGateProps {
  children: ReactNode;
}

/**
 * Gates the app behind auth bootstrap: shows a splash while
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
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-text"
      >
        <Spinner label={t('auth.splashLabel')} />
        <p className="text-text-secondary">{t('auth.splashLabel')}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-text">
        <p className="text-lg font-medium">{t('auth.errorTitle')}</p>
        <p className="text-text-secondary">{t('auth.errorBody')}</p>
        <Button onClick={() => void bootstrap()}>{t('auth.retry')}</Button>
      </div>
    );
  }

  return <>{children}</>;
}
