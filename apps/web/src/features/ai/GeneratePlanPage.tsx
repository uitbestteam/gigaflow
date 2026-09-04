import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  EquipmentType,
  ExperienceLevel,
  Goal,
  InjuryArea,
  MuscleGroup,
  type GenerateWorkoutInput,
  type PlanWithTemplates,
} from '@gigaflow/shared';
import { generateWorkout, getGenerationJob, getPlan } from '../../lib/api';
import { useJobPolling } from '../../lib/useJobPolling';
import { resolveTranslatable } from '../../lib/i18n';
import { JobProgress } from '../../components/JobProgress';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Wizard, type WizardStep } from '../../components/Wizard';
import { ChoiceChips, OptionCards, type Choice } from '../../components/form';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { SparklesIcon, CheckIcon } from '../../components/icons';
import { ROUTES, planEditPath } from '../../routes';

const GOAL_OPTIONS: Goal[] = [Goal.STRENGTH, Goal.HYPERTROPHY, Goal.GENERAL_FITNESS, Goal.WEIGHT_LOSS];
const EXPERIENCE_OPTIONS: ExperienceLevel[] = [
  ExperienceLevel.BEGINNER,
  ExperienceLevel.INTERMEDIATE,
  ExperienceLevel.ADVANCED,
];
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const SESSION_OPTIONS = [30, 45, 60, 90] as const;
const EQUIPMENT_OPTIONS: EquipmentType[] = [
  EquipmentType.BARBELL,
  EquipmentType.DUMBBELL,
  EquipmentType.MACHINE,
  EquipmentType.BODYWEIGHT,
  EquipmentType.CABLE,
];
const INJURY_OPTIONS: InjuryArea[] = [
  InjuryArea.KNEE,
  InjuryArea.LOWER_BACK,
  InjuryArea.SHOULDER,
  InjuryArea.ELBOW_WRIST,
  InjuryArea.HIP,
  InjuryArea.NECK,
];
// Emphasis excludes cardio — it is not a "grow this muscle" target.
const EMPHASIS_OPTIONS: MuscleGroup[] = [
  MuscleGroup.CHEST,
  MuscleGroup.BACK,
  MuscleGroup.LEGS,
  MuscleGroup.SHOULDERS,
  MuscleGroup.ARMS,
  MuscleGroup.CORE,
];

type EquipmentPreset = 'full_gym' | 'home' | 'bodyweight' | 'custom';
const EQUIPMENT_PRESETS: EquipmentPreset[] = ['full_gym', 'home', 'bodyweight', 'custom'];

/** Maps a preset to the concrete equipment list the API expects. */
function presetEquipment(preset: EquipmentPreset, custom: EquipmentType[]): EquipmentType[] {
  switch (preset) {
    case 'full_gym':
      return [...EQUIPMENT_OPTIONS];
    case 'home':
      return [EquipmentType.DUMBBELL, EquipmentType.BODYWEIGHT, EquipmentType.CABLE];
    case 'bodyweight':
      return [EquipmentType.BODYWEIGHT];
    case 'custom':
      return custom;
  }
}

/** AI-generated workout plan page (spec §4.3): a multi-step wizard collects intake,
 * then a job-polling loop shows progress, and the resulting plan can be handed off to the builder. */
export function GeneratePlanPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [goal, setGoal] = useState<Goal>();
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>();
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState<number>();
  const [preset, setPreset] = useState<EquipmentPreset>();
  const [customEquipment, setCustomEquipment] = useState<EquipmentType[]>([]);
  const [injuries, setInjuries] = useState<InjuryArea[]>([]);
  const [emphasis, setEmphasis] = useState<MuscleGroup[]>([]);

  const { run, status, job, result, error } = useJobPolling<PlanWithTemplates, GenerateWorkoutInput>({
    start: generateWorkout,
    poll: getGenerationJob,
    persistKey: 'gf.job.workout',
    fetchResult: (currentJob) => {
      if (!currentJob.resultId) {
        return Promise.reject(new Error('Generation job is missing a result id'));
      }
      return getPlan(currentJob.resultId);
    },
  });

  const isBusy = status === 'submitting' || status === 'polling';

  const submit = () => {
    if (!goal || !experienceLevel) return;
    const input: GenerateWorkoutInput = { goal, experienceLevel, daysPerWeek };
    if (sessionMinutes) input.sessionMinutes = sessionMinutes;
    if (preset) {
      const equipment = presetEquipment(preset, customEquipment);
      if (equipment.length > 0) input.availableEquipment = equipment;
    }
    if (injuries.length > 0) input.injuries = injuries;
    if (emphasis.length > 0) input.emphasis = emphasis;
    void run(input);
  };

  const handleEditInBuilder = () => {
    if (!job?.resultId) return;
    void queryClient.invalidateQueries({ queryKey: ['plans'] });
    void queryClient.invalidateQueries({ queryKey: ['activePlan'] });
    navigate(planEditPath(job.resultId));
  };

  const goalChoices: Choice<Goal>[] = GOAL_OPTIONS.map((value) => ({ value, label: t(`ai.goal.${value}`) }));
  const experienceChoices: Choice<ExperienceLevel>[] = EXPERIENCE_OPTIONS.map((value) => ({
    value,
    label: t(`ai.experience.${value}`),
  }));
  const daysChoices: Choice<string>[] = DAYS_OPTIONS.map((n) => ({ value: String(n), label: String(n) }));
  const sessionChoices: Choice<string>[] = SESSION_OPTIONS.map((n) => ({
    value: String(n),
    label: `${n} ${t('ai.minShort')}`,
  }));
  const presetChoices: Choice<EquipmentPreset>[] = EQUIPMENT_PRESETS.map((value) => ({
    value,
    label: t(`ai.equipmentPreset.${value}`),
    desc: t(`ai.equipmentPreset.${value}_desc`),
  }));
  const equipmentChoices: Choice<EquipmentType>[] = EQUIPMENT_OPTIONS.map((value) => ({
    value,
    label: t(`exercises.equipment.${value}`),
  }));
  const injuryChoices: Choice<InjuryArea>[] = INJURY_OPTIONS.map((value) => ({
    value,
    label: t(`ai.injury.${value}`),
  }));
  const emphasisChoices: Choice<MuscleGroup>[] = EMPHASIS_OPTIONS.map((value) => ({
    value,
    label: t(`exercises.muscle.${value}`),
  }));

  const steps: WizardStep[] = [
    {
      title: t('ai.stepGoalTitle'),
      subtitle: t('ai.stepGoalSubtitle'),
      valid: goal != null && experienceLevel != null,
      content: (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('ai.goalLabel')}</span>
            <OptionCards options={goalChoices} value={goal} onChange={setGoal} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('ai.experienceLabel')}</span>
            <OptionCards options={experienceChoices} value={experienceLevel} onChange={setExperienceLevel} />
          </div>
        </div>
      ),
    },
    {
      title: t('ai.stepScheduleTitle'),
      subtitle: t('ai.stepScheduleSubtitle'),
      content: (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary" id="days-label">
              {t('ai.daysLabel')}
            </span>
            <ChoiceChips
              options={daysChoices}
              value={String(daysPerWeek)}
              onChange={(next) => setDaysPerWeek(Number(next as string))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">
              {t('ai.sessionLabel')} <span className="text-text-muted">· {t('wizard.optional')}</span>
            </span>
            <ChoiceChips
              options={sessionChoices}
              value={sessionMinutes != null ? String(sessionMinutes) : undefined}
              onChange={(next) => {
                const n = Number(next as string);
                setSessionMinutes((prev) => (prev === n ? undefined : n));
              }}
            />
          </div>
        </div>
      ),
    },
    {
      title: t('ai.stepEquipmentTitle'),
      subtitle: t('ai.stepEquipmentSubtitle'),
      valid: preset != null && (preset !== 'custom' || customEquipment.length > 0),
      content: (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('ai.equipmentPresetLabel')}</span>
            <OptionCards options={presetChoices} value={preset} onChange={setPreset} />
          </div>
          {preset === 'custom' && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">{t('ai.equipmentCustomLabel')}</span>
              <ChoiceChips
                options={equipmentChoices}
                value={customEquipment}
                onChange={(next) => setCustomEquipment(next as EquipmentType[])}
                multiple
              />
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('ai.stepInjuriesTitle'),
      subtitle: t('ai.stepInjuriesSubtitle'),
      content: (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-text-secondary">{t('ai.injuriesLabel')}</span>
          <ChoiceChips
            options={injuryChoices}
            value={injuries}
            onChange={(next) => setInjuries(next as InjuryArea[])}
            multiple
          />
          {injuries.length > 0 && (
            <Button variant="ghost" className="self-start" onClick={() => setInjuries([])}>
              {t('ai.none')}
            </Button>
          )}
        </div>
      ),
    },
    {
      title: t('ai.stepEmphasisTitle'),
      subtitle: t('ai.stepEmphasisSubtitle'),
      content: (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-text-secondary">
            {t('ai.emphasisLabel')} <span className="text-text-muted">· {t('wizard.optional')}</span>
          </span>
          <ChoiceChips
            options={emphasisChoices}
            value={emphasis}
            onChange={(next) => setEmphasis(next as MuscleGroup[])}
            multiple
          />
        </div>
      ),
    },
  ];

  const showPreview = status === 'done' && result;

  return (
    <div className="flex flex-col gap-5 p-4">
      <FadeIn>
        <div className="flex flex-col items-center gap-3 rounded-lg bg-grad-primary-soft p-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-grad-primary shadow-glow-accent">
            <SparklesIcon className="text-white" width={28} height={28} />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight text-gradient">{t('ai.title')}</h1>
          <p className="text-sm text-text-secondary">{t('ai.heroSubtitle')}</p>
        </div>
      </FadeIn>

      {!showPreview && !isBusy && status !== 'error' && (
        <Card variant="flat">
          <Wizard steps={steps} onComplete={submit} finishLabel={t('ai.submit')} submitting={isBusy} />
        </Card>
      )}

      {isBusy && <JobProgress status={status} error={error} className="justify-center" />}

      {status === 'error' && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-warning">{error}</span>
          <Button variant="ghost" onClick={submit}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {showPreview && (
        <FadeIn>
          <Card variant="glow" className="flex flex-col gap-3 animate-pop">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-grad-primary shadow-glow-accent">
                <CheckIcon className="text-white" width={18} height={18} />
              </span>
              <h2 className="text-base font-semibold text-text">{result.name}</h2>
            </div>
            <Stagger className="flex flex-col gap-1">
              {result.templates.map((template) => (
                <StaggerItem
                  key={template.id}
                  className="rounded-[10px] bg-surface-elevated px-3 py-2 text-sm text-text-secondary"
                >
                  {resolveTranslatable(template.name, i18n.language)} · {template.slots.length}{' '}
                  {t('ai.exercisesCount')}
                </StaggerItem>
              ))}
            </Stagger>
            <div className="flex gap-2">
              <Button onClick={handleEditInBuilder} fullWidth>
                {t('ai.editInBuilder')}
              </Button>
              <Button variant="ghost" onClick={() => navigate(ROUTES.plans)}>
                {t('ai.backToPlans')}
              </Button>
            </div>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
