import { useEffect } from 'react';
import { UpgradePrompt } from '../auth/UpgradePrompt';
import { NotificationsSettings } from './NotificationsSettings';
import { useNotificationStore } from '../../store/notificationStore';

/**
 * `/account` route. Composes the existing account-upgrade UI with the new
 * notification-reminders toggle; syncs the notification store's status
 * with the browser's actual permission/stored-token state once on mount.
 */
export function AccountPage() {
  useEffect(() => {
    void useNotificationStore.getState().init();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <UpgradePrompt />
      <NotificationsSettings />
    </div>
  );
}
