import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UpgradePrompt } from '../auth/UpgradePrompt';
import { NotificationsSettings } from './NotificationsSettings';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { LanguageToggle, type LanguageCode } from '../../components/LanguageToggle';
import { UserIcon, DumbbellIcon, CameraIcon, ChevronRightIcon } from '../../components/icons';
import { ROUTES } from '../../routes';

/**
 * `/account` route. A settings hub: profile header, the existing
 * upgrade/sign-in card and notification-reminders toggle, plus nav rows to
 * secondary destinations not reachable from the bottom nav (Exercise
 * Library, InBody) and a language switch. Syncs the notification store's
 * status with the browser's actual permission/stored-token state once on
 * mount.
 */
export function AccountPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const status = useAuthStore((s) => s.status);
  const photoURL = useAuthStore((s) => s.photoURL);
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    void useNotificationStore.getState().init();
  }, []);

  const handleLanguageChange = (next: LanguageCode) => {
    void i18n.changeLanguage(next);
  };

  const displayName = isGuest
    ? t('account.guestName')
    : user?.displayName ?? user?.email ?? t('account.title');
  const subtitle = isGuest ? t('account.subtitle') : user?.email ?? t('account.subtitle');

  return (
    <div className="flex flex-col gap-6 p-4 pb-4">
      <FadeIn>
        <Card variant="glow" className="flex items-center gap-4">
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              className="h-14 w-14 shrink-0 rounded-pill border border-border object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-pill bg-accent text-white">
              <UserIcon width={28} height={28} />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-text">{displayName}</h1>
              {isGuest && (
                <span className="shrink-0 rounded-pill border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                  {t('account.guestBadge')}
                </span>
              )}
            </div>
            <p className="truncate text-sm text-text-secondary">{subtitle}</p>
          </div>
        </Card>
      </FadeIn>

      {isGuest ? (
        <FadeIn delay={0.05}>
          <UpgradePrompt />
        </FadeIn>
      ) : (
        <FadeIn delay={0.05}>
          <Button
            variant="outline"
            fullWidth
            disabled={status === 'loading'}
            onClick={() => void signOut()}
          >
            {t('account.signOut')}
          </Button>
        </FadeIn>
      )}

      <FadeIn delay={0.1} className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-text">{t('account.moreTitle')}</h2>
        <Stagger>
          <Card variant="default" className="flex flex-col divide-y divide-border-subtle p-0">
            <StaggerItem>
              <Link
                to={ROUTES.exercises}
                className="flex min-h-11 items-center gap-3 p-4 transition-colors active:bg-surface-2"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-push/15 text-push">
                  <DumbbellIcon width={20} height={20} />
                </span>
                <span className="flex-1 font-medium text-text">{t('account.exercisesNav')}</span>
                <ChevronRightIcon width={20} height={20} className="text-text-muted" />
              </Link>
            </StaggerItem>
            <StaggerItem>
              <Link
                to={ROUTES.inbody}
                className="flex min-h-11 items-center gap-3 p-4 transition-colors active:bg-surface-2"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-core/15 text-core">
                  <CameraIcon width={20} height={20} />
                </span>
                <span className="flex-1 font-medium text-text">{t('account.inbodyNav')}</span>
                <ChevronRightIcon width={20} height={20} className="text-text-muted" />
              </Link>
            </StaggerItem>
          </Card>
        </Stagger>
      </FadeIn>

      <FadeIn delay={0.15}>
        <Card variant="default" className="flex items-center justify-between gap-3">
          <span className="font-medium text-text">{t('account.languageLabel')}</span>
          <LanguageToggle value={i18n.language === 'vi' ? 'vi' : 'en'} onChange={handleLanguageChange} />
        </Card>
      </FadeIn>

      <FadeIn delay={0.2}>
        <NotificationsSettings />
      </FadeIn>
    </div>
  );
}
