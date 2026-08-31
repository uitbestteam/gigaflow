import { useTranslation } from 'react-i18next';
import type { Award } from '@gigaflow/shared';
import { resolveTranslatable } from '../../lib/i18n';

export interface AwardCardProps {
  award: Award;
}

/**
 * A single award tile (spec §4.6): translated name/description, a
 * current/target progress bar (clamped to 0..1, guarding a zero target),
 * and an amber "earned" badge once `award.earned` is true.
 */
export function AwardCard({ award }: AwardCardProps) {
  const { t, i18n } = useTranslation();
  const name = resolveTranslatable(award.name, i18n.language);
  const description = resolveTranslatable(award.description, i18n.language);
  const ratio = award.target > 0 ? award.current / award.target : award.earned ? 1 : 0;
  const clampedRatio = Math.min(1, Math.max(0, ratio));

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-text">{name}</span>
        {award.earned && (
          <span className="inline-flex min-h-6 items-center rounded-full bg-warning/20 px-2 text-xs font-medium text-warning">
            {t('stats.earnedBadge')}
          </span>
        )}
      </div>
      <p className="text-sm text-text-secondary">{description}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border-subtle">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${clampedRatio * 100}%` }}
        />
      </div>
      <span className="tnum text-xs text-text-muted">
        {award.current}/{award.target}
      </span>
    </div>
  );
}
