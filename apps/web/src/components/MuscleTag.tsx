import { MuscleGroup } from '@gigaflow/shared';
import { useTranslation } from 'react-i18next';

export interface MuscleTagProps {
  muscleGroup: MuscleGroup;
  className?: string;
}

/**
 * Maps every MuscleGroup member to a background/text color pairing. Reuses
 * existing semantic tokens (no new tokens introduced) — chest/back/legs/core
 * borrow the split-identity colors (push/pull/legs/core) so a scanning list
 * reads by color, the rest fall back to neutral-ish accents.
 */
const MUSCLE_CLASSES: Record<MuscleGroup, string> = {
  [MuscleGroup.CHEST]: 'bg-push/15 text-push ring-1 ring-inset ring-push/30',
  [MuscleGroup.BACK]: 'bg-pull/15 text-pull ring-1 ring-inset ring-pull/30',
  [MuscleGroup.LEGS]: 'bg-legs/15 text-legs ring-1 ring-inset ring-legs/30',
  [MuscleGroup.SHOULDERS]: 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30',
  [MuscleGroup.ARMS]: 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/30',
  [MuscleGroup.CORE]: 'bg-core/15 text-core ring-1 ring-inset ring-core/30',
  [MuscleGroup.CARDIO]: 'bg-surface-3 text-text-secondary ring-1 ring-inset ring-border-subtle',
};

export function MuscleTag({ muscleGroup, className = '' }: MuscleTagProps) {
  const { t } = useTranslation();

  const classes = [
    'inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold tracking-wide',
    MUSCLE_CLASSES[muscleGroup],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{t(`exercises.muscle.${muscleGroup}`)}</span>;
}
