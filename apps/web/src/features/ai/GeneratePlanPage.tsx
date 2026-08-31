import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExperienceLevel, Goal, type GenerateWorkoutInput, type PlanWithTemplates } from '@gigaflow/shared';
import { generateWorkout, getGenerationJob, getPlan } from '../../lib/api';
import { useJobPolling } from '../../lib/useJobPolling';
import { resolveTranslatable } from '../../lib/i18n';
import { JobProgress } from '../../components/JobProgress';
import { SegmentedFilter } from '../../components/SegmentedFilter';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ROUTES, planEditPath } from '../../routes';

const GOAL_OPTIONS: Goal[] = [Goal.STRENGTH, Goal.HYPERTROPHY, Goal.GENERAL_FITNESS, Goal.WEIGHT_LOSS];
const EXPERIENCE_OPTIONS: ExperienceLevel[] = [
  ExperienceLevel.BEGINNER,
  ExperienceLevel.INTERMEDIATE,
  ExperienceLevel.ADVANCED,
];

/** AI-generated workout plan page (spec §4.3): a short form kicks off generation, then
 * a job-polling loop shows progress, and the resulting plan can be handed off to the builder. */
export function GeneratePlanPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [goal, setGoal] = useState<Goal>(Goal.STRENGTH);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(ExperienceLevel.BEGINNER);
  const [daysPerWeek, setDaysPerWeek] = useState(3);

  const { run, status, job, result, error } = useJobPolling<PlanWithTemplates, GenerateWorkoutInput>({
    start: generateWorkout,
    poll: getGenerationJob,
    fetchResult: (currentJob) => {
      if (!currentJob.resultId) {
        return Promise.reject(new Error('Generation job is missing a result id'));
      }
      return getPlan(currentJob.resultId);
    },
  });

  const isBusy = status === 'submitting' || status === 'polling';

  const submit = () => {
    void run({ goal, experienceLevel, daysPerWeek });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleEditInBuilder = () => {
    if (!job?.resultId) return;
    void queryClient.invalidateQueries({ queryKey: ['plans'] });
    void queryClient.invalidateQueries({ queryKey: ['activePlan'] });
    navigate(planEditPath(job.resultId));
  };

  const showPreview = status === 'done' && result;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-text">{t('ai.title')}</h1>

      {!showPreview && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('ai.goalLabel')}</span>
            <SegmentedFilter
              options={GOAL_OPTIONS.map((option) => ({ value: option, label: t(`ai.goal.${option}`) }))}
              value={goal}
              onChange={setGoal}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('ai.experienceLabel')}</span>
            <SegmentedFilter
              options={EXPERIENCE_OPTIONS.map((option) => ({ value: option, label: t(`ai.experience.${option}`) }))}
              value={experienceLevel}
              onChange={setExperienceLevel}
            />
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('ai.daysLabel')}</span>
            <input
              type="number"
              min={1}
              max={7}
              value={daysPerWeek}
              onChange={(event) => setDaysPerWeek(Number(event.target.value))}
              className="min-h-11 max-w-[8rem] rounded-[10px] border border-border bg-surface px-3 text-text"
            />
          </label>

          <Button type="submit" disabled={isBusy}>
            {t('ai.submit')}
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

      {showPreview && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-text">{result.name}</h2>
          <div className="flex flex-col gap-1">
            {result.templates.map((template) => (
              <div key={template.id} className="text-sm text-text-secondary">
                {resolveTranslatable(template.name, i18n.language)} · {template.slots.length} {t('ai.exercisesCount')}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleEditInBuilder}>{t('ai.editInBuilder')}</Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.plans)}>
              {t('ai.backToPlans')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
