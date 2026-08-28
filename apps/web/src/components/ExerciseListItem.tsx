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
    <Card className={['flex items-center justify-between gap-3', className].filter(Boolean).join(' ')}>
      <div className="flex flex-col gap-1">
        <span className="font-medium text-text">{name}</span>
        <span className="text-sm text-text-secondary">{t(`exercises.equipment.${exercise.equipmentType}`)}</span>
      </div>
      <MuscleTag muscleGroup={exercise.muscleGroup} />
    </Card>
  );
}
