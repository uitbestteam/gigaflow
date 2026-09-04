import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { GoogleIcon } from '../../components/icons';
import { FadeIn } from '../../components/motion';
import { useAuthStore } from '../../store/authStore';

/**
 * Lets a guest user link a permanent identity: Google one-click, or
 * email/password. Both paths call into `authStore` (`upgradeGoogle` /
 * `upgradeEmail`), which own the actual Firebase calls — this component is
 * UI only and never touches `firebase/*` directly.
 */
export function UpgradePrompt() {
  const { t } = useTranslation();
  const upgradeGoogle = useAuthStore((s) => s.upgradeGoogle);
  const upgradeEmail = useAuthStore((s) => s.upgradeEmail);
  const status = useAuthStore((s) => s.status);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submitting = status === 'loading';

  function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void upgradeEmail(email, password);
  }

  const inputClass =
    'min-h-11 rounded-md border border-border bg-surface-2 px-3.5 text-text placeholder:text-text-muted ' +
    'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors';

  return (
    <FadeIn>
      <Card variant="glow" className="flex flex-col gap-5 p-5">
        <div className="text-center">
          <h2 className="text-xl font-extrabold tracking-tight">
            <span className="text-gradient">{t('auth.upgradeTitle')}</span>
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{t('auth.upgradeBody')}</p>
        </div>

        <Button
          variant="ghost"
          size="lg"
          fullWidth
          disabled={submitting}
          onClick={() => void upgradeGoogle()}
          className="border border-border !bg-surface-2"
        >
          <GoogleIcon />
          <span>{t('auth.continueWithGoogle')}</span>
        </Button>

        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="h-px flex-1 bg-border-subtle" />
          {t('auth.emailLabel')}
          <span className="h-px flex-1 bg-border-subtle" />
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleEmailSubmit}>
          <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
            {t('auth.emailLabel')}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
            {t('auth.passwordLabel')}
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <Button type="submit" size="lg" fullWidth disabled={submitting}>
            {t('auth.upgradeWithEmail')}
          </Button>
        </form>
      </Card>
    </FadeIn>
  );
}
