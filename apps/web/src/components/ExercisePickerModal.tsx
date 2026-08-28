import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MuscleGroup } from '@gigaflow/shared';
import type { Exercise } from '@gigaflow/shared';
import { getExercises } from '../lib/api';
import { SearchInput } from './SearchInput';
import { SegmentedFilter, type SegmentedFilterOption } from './SegmentedFilter';
import { ExerciseListItem } from './ExerciseListItem';
import { Spinner } from './Spinner';

export interface ExercisePickerModalProps {
  open: boolean;
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

const MUSCLE_GROUPS = Object.values(MuscleGroup);
const ALL_FILTER = 'all' as const;
type MuscleFilter = MuscleGroup | typeof ALL_FILTER;

/**
 * A dialog for picking an exercise into a plan slot. Reuses the exercise
 * library's search + muscle filter + list. Closes on Escape or overlay
 * click; picking an item calls `onPick` then `onClose`.
 */
export function ExercisePickerModal({ open, onPick, onClose }: ExercisePickerModalProps) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>(ALL_FILTER);

  const muscleGroup = muscleFilter === ALL_FILTER ? undefined : muscleFilter;

  const exercisesQuery = useQuery({
    queryKey: ['exercises', { q, muscleGroup }],
    queryFn: () => getExercises({ q: q || undefined, muscleGroup }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filterOptions: SegmentedFilterOption<MuscleFilter>[] = [
    { value: ALL_FILTER, label: t('exercises.filterAll') },
    ...MUSCLE_GROUPS.map((group) => ({ value: group, label: t(`exercises.muscle.${group}`) })),
  ];

  function handlePick(exercise: Exercise) {
    onPick(exercise);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('builder.pickExerciseTitle')}
        className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-[16px] bg-surface p-4 sm:rounded-[16px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text">{t('builder.pickExerciseTitle')}</h2>

        <SearchInput value={q} onChange={setQ} placeholder={t('exercises.searchPlaceholder')} />

        <SegmentedFilter options={filterOptions} value={muscleFilter} onChange={setMuscleFilter} />

        {exercisesQuery.isLoading && (
          <div className="flex items-center justify-center p-8">
            <Spinner label={t('common.loading')} />
          </div>
        )}

        {exercisesQuery.data && exercisesQuery.data.length === 0 && (
          <p className="text-text-secondary">{t('exercises.empty')}</p>
        )}

        {exercisesQuery.data && exercisesQuery.data.length > 0 && (
          <div className="flex flex-col gap-2">
            {exercisesQuery.data.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                className="w-full text-left"
                onClick={() => handlePick(exercise)}
              >
                <ExerciseListItem exercise={exercise} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
