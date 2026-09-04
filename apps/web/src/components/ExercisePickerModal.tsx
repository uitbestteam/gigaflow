import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MuscleGroup } from '@gigaflow/shared';
import type { Exercise } from '@gigaflow/shared';
import { getExercises } from '../lib/api';
import { SearchInput } from './SearchInput';
import { SegmentedFilter, type SegmentedFilterOption } from './SegmentedFilter';
import { ExerciseListItem } from './ExerciseListItem';
import { SkeletonList } from './Skeleton';
import { Stagger, StaggerItem } from './motion';
import { SparklesIcon } from './icons';

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
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t('builder.pickExerciseTitle')}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-lg border-t border-border-subtle bg-surface p-4 shadow-card sm:rounded-lg sm:border"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      >
          <div className="mx-auto -mt-1 h-1.5 w-10 shrink-0 rounded-pill bg-border sm:hidden" aria-hidden="true" />

          <h2 className="text-lg font-bold text-text">{t('builder.pickExerciseTitle')}</h2>

          <SearchInput value={q} onChange={setQ} placeholder={t('exercises.searchPlaceholder')} />

          <SegmentedFilter options={filterOptions} value={muscleFilter} onChange={setMuscleFilter} />

          {exercisesQuery.isLoading && <SkeletonList rows={4} />}

          {exercisesQuery.data && exercisesQuery.data.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <SparklesIcon width={24} height={24} className="text-text-muted" />
              <p className="text-text-secondary">{t('exercises.empty')}</p>
            </div>
          )}

          {exercisesQuery.data && exercisesQuery.data.length > 0 && (
            <Stagger className="flex flex-col gap-2 pb-1">
              {exercisesQuery.data.map((exercise) => (
                <StaggerItem key={exercise.id}>
                  <button
                    type="button"
                    className="w-full text-left transition-transform active:scale-[0.98]"
                    onClick={() => handlePick(exercise)}
                  >
                    <ExerciseListItem exercise={exercise} />
                  </button>
                </StaggerItem>
              ))}
            </Stagger>
          )}
      </motion.div>
    </motion.div>
  );
}
