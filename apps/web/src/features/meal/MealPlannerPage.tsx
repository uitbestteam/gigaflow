import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityLevel, Gender, Goal, type GenerateMealInput, type MealPlanDoc } from '@gigaflow/shared';
import { generateMeal, getActiveMeal, getMealJob } from '../../lib/api';
import { useJobPolling } from '../../lib/useJobPolling';
import { JobProgress } from '../../components/JobProgress';
import { SegmentedFilter } from '../../components/SegmentedFilter';
import { Button } from '../../components/Button';
import { MealDayView } from './MealDayView';

const GOAL_OPTIONS: Goal[] = [Goal.STRENGTH, Goal.HYPERTROPHY, Goal.GENERAL_FITNESS, Goal.WEIGHT_LOSS];
const GENDER_OPTIONS: Gender[] = [Gender.MALE, Gender.FEMALE];
const ACTIVITY_OPTIONS: ActivityLevel[] = [
  ActivityLevel.SEDENTARY,
  ActivityLevel.LIGHT,
  ActivityLevel.MODERATE,
  ActivityLevel.ACTIVE,
  ActivityLevel.VERY_ACTIVE,
];

/** AI-generated meal plan page (spec §4.4): shows the active plan if one
 * exists, otherwise a short form kicks off generation with a job-polling
 * loop, then the resulting plan is fetched and shown. */
export function MealPlannerPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const activeMealQuery = useQuery({ queryKey: ['mealActive'], queryFn: () => getActiveMeal() });

  const [goal, setGoal] = useState<Goal>(Goal.STRENGTH);
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [age, setAge] = useState(30);
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(ActivityLevel.MODERATE);

  const { run, status, result, error } = useJobPolling<MealPlanDoc | null, GenerateMealInput>({
    start: generateMeal,
    poll: getMealJob,
    fetchResult: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mealActive'] });
      return getActiveMeal();
    },
  });

  const isBusy = status === 'submitting' || status === 'polling';

  const submit = () => {
    void run({ goal, gender, age, heightCm, weightKg, activityLevel });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const plan = status === 'done' && result !== undefined ? result : activeMealQuery.data;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-text">{t('meal.title')}</h1>

      {plan && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-text">{plan.name}</h2>
          {plan.days.map((day) => (
            <MealDayView key={day.dayIndex} day={day} />
          ))}
        </div>
      )}

      {!plan && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('meal.goalLabel')}</span>
            <SegmentedFilter
              options={GOAL_OPTIONS.map((option) => ({ value: option, label: t(`meal.goal.${option}`) }))}
              value={goal}
              onChange={setGoal}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('meal.genderLabel')}</span>
            <SegmentedFilter
              options={GENDER_OPTIONS.map((option) => ({ value: option, label: t(`meal.gender.${option}`) }))}
              value={gender}
              onChange={setGender}
            />
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('meal.ageLabel')}</span>
            <input
              type="number"
              min={10}
              max={100}
              value={age}
              onChange={(event) => setAge(Number(event.target.value))}
              className="min-h-11 max-w-[8rem] rounded-[10px] border border-border bg-surface px-3 text-text"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('meal.heightLabel')}</span>
            <input
              type="number"
              min={1}
              value={heightCm}
              onChange={(event) => setHeightCm(Number(event.target.value))}
              className="min-h-11 max-w-[8rem] rounded-[10px] border border-border bg-surface px-3 text-text"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('meal.weightLabel')}</span>
            <input
              type="number"
              min={1}
              value={weightKg}
              onChange={(event) => setWeightKg(Number(event.target.value))}
              className="min-h-11 max-w-[8rem] rounded-[10px] border border-border bg-surface px-3 text-text"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('meal.activityLabel')}</span>
            <SegmentedFilter
              options={ACTIVITY_OPTIONS.map((option) => ({
                value: option,
                label: t(`meal.activity.${option}`),
              }))}
              value={activityLevel}
              onChange={setActivityLevel}
            />
          </div>

          <Button type="submit" disabled={isBusy}>
            {t('meal.submit')}
          </Button>

          {isBusy && <JobProgress status={status} error={error} />}

          {status === 'error' && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-warning">{error}</span>
              <Button variant="ghost" onClick={submit}>
                {t('common.retry')}
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
