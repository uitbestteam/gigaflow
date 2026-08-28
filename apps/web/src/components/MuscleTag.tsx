import { MuscleGroup } from '@gigaflow/shared';
import { useTranslation } from 'react-i18next';

export interface MuscleTagProps {
  muscleGroup: MuscleGroup;
  className?: string;
}

/**
 * Maps every MuscleGroup member to a background/text color pairing. Reuses
 * existing semantic tokens (no new tokens introduced) so the tag stays
 * consistent with the rest of the dark-only palette.
 */
const MUSCLE_CLASSES: Record<MuscleGroup, string> = {
  [MuscleGroup.CHEST]: 'bg-push/20 text-push',
  [MuscleGroup.BACK]: 'bg-pull/20 text-pull',
  [MuscleGroup.LEGS]: 'bg-legs/20 text-legs',
  [MuscleGroup.SHOULDERS]: 'bg-accent/20 text-accent',
  [MuscleGroup.ARMS]: 'bg-warning/20 text-warning',
  [MuscleGroup.CORE]: 'bg-success/20 text-success',
  [MuscleGroup.CARDIO]: 'bg-surface-elevated text-text-secondary',
};

export function MuscleTag({ muscleGroup, className = '' }: MuscleTagProps) {
  const { t } = useTranslation();

  const classes = [
    'inline-flex items-center rounded-full px-2 py-1 text-sm font-medium',
    MUSCLE_CLASSES[muscleGroup],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{t(`exercises.muscle.${muscleGroup}`)}</span>;
}
