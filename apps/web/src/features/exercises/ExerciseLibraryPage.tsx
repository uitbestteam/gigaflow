import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MuscleGroup } from '@gigaflow/shared';
import { getExercises } from '../../lib/api';
import { SearchInput } from '../../components/SearchInput';
import { SegmentedFilter, type SegmentedFilterOption } from '../../components/SegmentedFilter';
import { ExerciseListItem } from '../../components/ExerciseListItem';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
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
      <h1 className="text-lg font-semibold text-text">{t('exercises.title')}</h1>

      <SearchInput value={q} onChange={setQ} placeholder={t('exercises.searchPlaceholder')} />

      <SegmentedFilter options={filterOptions} value={muscleFilter} onChange={setMuscleFilter} />

      <Button variant="ghost" className="self-start" onClick={() => setShowCustomForm((prev) => !prev)}>
        {t('exercises.addCustom')}
      </Button>

      {showCustomForm && <CustomExerciseForm onCreated={() => setShowCustomForm(false)} />}

      {exercisesQuery.isLoading && (
        <div className="flex items-center justify-center p-8">
          <Spinner label={t('common.loading')} />
        </div>
      )}

      {exercisesQuery.isError && (
        <div>
          <p className="text-text-secondary">{t('exercises.loadError')}</p>
          <Button className="mt-3" onClick={() => void exercisesQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {exercisesQuery.data && exercisesQuery.data.length === 0 && (
        <p className="text-text-secondary">{t('exercises.empty')}</p>
      )}

      {exercisesQuery.data && exercisesQuery.data.length > 0 && (
        <div className="flex flex-col gap-2">
          {exercisesQuery.data.map((exercise) => (
            <ExerciseListItem key={exercise.id} exercise={exercise} />
          ))}
        </div>
      )}
    </div>
  );
}
