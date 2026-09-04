import type { Exercise } from '@gigaflow/shared';
import { useTranslation } from 'react-i18next';
import { resolveTranslatable } from '../lib/i18n';
import { MuscleTag } from './MuscleTag';
import { Card } from './Card';

export interface ExerciseListItemProps {
  exercise: Exercise;
  className?: string;
}

export function ExerciseListItem({ exercise, className = '' }: ExerciseListItemProps) {
  const { t, i18n } = useTranslation();
  const name = resolveTranslatable(exercise.name, i18n.language);

  return (
    <Card
      className={[
        'flex items-center justify-between gap-3 transition-colors active:bg-surface-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-semibold text-text">{name}</span>
        <span className="text-sm text-text-secondary">{t(`exercises.equipment.${exercise.equipmentType}`)}</span>
      </div>
      <MuscleTag muscleGroup={exercise.muscleGroup} className="shrink-0" />
    </Card>
  );
}
