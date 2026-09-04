import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MuscleGroup } from '@gigaflow/shared';
import { getExercises } from '../../lib/api';
import { SearchInput } from '../../components/SearchInput';
import { SegmentedFilter, type SegmentedFilterOption } from '../../components/SegmentedFilter';
import { ExerciseListItem } from '../../components/ExerciseListItem';
import { Button } from '../../components/Button';
import { SkeletonList } from '../../components/Skeleton';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { PlusIcon, SparklesIcon } from '../../components/icons';
import { CustomExerciseForm } from './CustomExerciseForm';

const MUSCLE_GROUPS = Object.values(MuscleGroup);
const ALL_FILTER = 'all' as const;
type MuscleFilter = MuscleGroup | typeof ALL_FILTER;

export function ExerciseLibraryPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>(ALL_FILTER);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const muscleGroup = muscleFilter === ALL_FILTER ? undefined : muscleFilter;

  const exercisesQuery = useQuery({
    queryKey: ['exercises', { q, muscleGroup }],
    queryFn: () => getExercises({ q: q || undefined, muscleGroup }),
  });

  const filterOptions: SegmentedFilterOption<MuscleFilter>[] = [
    { value: ALL_FILTER, label: t('exercises.filterAll') },
    ...MUSCLE_GROUPS.map((group) => ({ value: group, label: t(`exercises.muscle.${group}`) })),
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <FadeIn className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-text">{t('exercises.title')}</h1>
        <Button
          variant={showCustomForm ? 'ghost' : 'outline'}
          size="sm"
          onClick={() => setShowCustomForm((prev) => !prev)}
        >
          <PlusIcon width={16} height={16} />
          {t('exercises.addCustom')}
        </Button>
      </FadeIn>

      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/85 px-4 pb-2 pt-1 backdrop-blur">
        <SearchInput value={q} onChange={setQ} placeholder={t('exercises.searchPlaceholder')} />
        <SegmentedFilter options={filterOptions} value={muscleFilter} onChange={setMuscleFilter} />
      </div>

      {showCustomForm && (
        <FadeIn>
          <CustomExerciseForm onCreated={() => setShowCustomForm(false)} />
        </FadeIn>
      )}

      {exercisesQuery.isLoading && <SkeletonList rows={5} />}

      {exercisesQuery.isError && (
        <FadeIn className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-text-secondary">{t('exercises.loadError')}</p>
          <Button onClick={() => void exercisesQuery.refetch()}>{t('common.retry')}</Button>
        </FadeIn>
      )}

      {exercisesQuery.data && exercisesQuery.data.length === 0 && (
        <FadeIn className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-grad-primary-soft text-accent">
            <SparklesIcon width={28} height={28} />
          </div>
          <p className="text-text-secondary">{t('exercises.empty')}</p>
        </FadeIn>
      )}

      {exercisesQuery.data && exercisesQuery.data.length > 0 && (
        <Stagger className="flex flex-col gap-2 pb-2">
          {exercisesQuery.data.map((exercise) => (
            <StaggerItem key={exercise.id}>
              <ExerciseListItem exercise={exercise} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
