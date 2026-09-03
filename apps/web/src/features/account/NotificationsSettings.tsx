import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { useNotificationStore } from '../../store/notificationStore';

/**
 * Push-reminder toggle for the account page. Reads `notificationStore`'s
 * status directly and drives its `enable`/`disable` actions — this
 * component never touches `firebase/*` itself, the store owns that.
 */
export function NotificationsSettings() {
  const { t } = useTranslation();
  const status = useNotificationStore((s) => s.status);
  const enable = useNotificationStore((s) => s.enable);
  const disable = useNotificationStore((s) => s.disable);

  const busy = status === 'enabling' || status === 'disabling';
  const isEnabled = status === 'enabled';

  function handleClick() {
    if (isEnabled) {
      void disable();
    } else {
      void enable();
    }
  }

  return (
    <Card className="mx-auto flex max-w-sm flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t('notif.title')}</h2>
        <p className="text-text-secondary">{t('notif.description')}</p>
      </div>

      <Button type="button" disabled={busy} onClick={handleClick} className="gap-2">
        {busy && <Spinner className="h-4 w-4" />}
        {isEnabled ? t('notif.disable') : t('notif.enable')}
      </Button>

      {status === 'denied' && <p className="text-sm text-text-secondary">{t('notif.deniedHint')}</p>}
      {status === 'error' && <p className="text-sm text-text-secondary">{t('notif.error')}</p>}
    </Card>
  );
}
