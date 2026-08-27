import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
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

  return (
    <Card className="mx-auto flex max-w-sm flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t('auth.upgradeTitle')}</h2>
        <p className="text-text-secondary">{t('auth.upgradeBody')}</p>
      </div>

      <Button type="button" disabled={submitting} onClick={() => void upgradeGoogle()}>
        {t('auth.continueWithGoogle')}
      </Button>

      <form className="flex flex-col gap-3" onSubmit={handleEmailSubmit}>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          {t('auth.emailLabel')}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 rounded-[10px] border border-border bg-surface-elevated px-3 text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          {t('auth.passwordLabel')}
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-11 rounded-[10px] border border-border bg-surface-elevated px-3 text-text"
          />
        </label>
        <Button type="submit" disabled={submitting}>
          {t('auth.upgradeWithEmail')}
        </Button>
      </form>
    </Card>
  );
}
