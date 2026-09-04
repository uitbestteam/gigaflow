import { useTranslation } from 'react-i18next';
import type { PerfSet } from '@gigaflow/shared';

export interface ProgressionBadgeProps {
  lastSet?: PerfSet;
  className?: string;
}

/**
 * Muted "prev: W × R" hint sourced from the exercise's last performed set.
 * Renders nothing when there is no prior set to compare against.
 */
export function ProgressionBadge({ lastSet, className = '' }: ProgressionBadgeProps) {
  const { t } = useTranslation();

  if (!lastSet) return null;

  const classes = ['tnum text-text-muted text-xs font-medium', className].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {t('session.prevSet', { weight: lastSet.weightKg, reps: lastSet.repsDone })}
    </span>
  );
}
