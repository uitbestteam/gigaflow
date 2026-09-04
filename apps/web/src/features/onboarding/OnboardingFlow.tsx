import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  EquipmentType,
  ExperienceLevel,
  Goal,
  type UserProfile,
} from '@gigaflow/shared';
import { saveProfile } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Wizard, type WizardStep } from '../../components/Wizard';
import { ChoiceChips, OptionCards, type Choice } from '../../components/form';
import { FadeIn } from '../../components/motion';
import { SparklesIcon } from '../../components/icons';
import { PresetPicker } from '../plans/PresetPicker';
import { ROUTES } from '../../routes';

const GOAL_OPTIONS: Goal[] = [Goal.STRENGTH, Goal.HYPERTROPHY, Goal.GENERAL_FITNESS, Goal.WEIGHT_LOSS];
const EXPERIENCE_OPTIONS: ExperienceLevel[] = [
  ExperienceLevel.BEGINNER,
  ExperienceLevel.INTERMEDIATE,
  ExperienceLevel.ADVANCED,
];
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const EQUIPMENT_OPTIONS: EquipmentType[] = [
  EquipmentType.BARBELL,
  EquipmentType.DUMBBELL,
  EquipmentType.MACHINE,
  EquipmentType.BODYWEIGHT,
  EquipmentType.CABLE,
];

type StartChoice = 'ai' | 'preset' | 'build';

/** Sensible defaults so "Skip" still produces a valid profile that marks the user onboarded. */
const DEFAULT_GOAL = Goal.GENERAL_FITNESS;
const DEFAULT_EXPERIENCE = ExperienceLevel.BEGINNER;
const DEFAULT_DAYS = 3;

/**
 * First-run onboarding (spec §F): a Welcome → Profile → Start-choice wizard.
 * On finish we persist the profile (which stamps `onboardedAt`, so the gate in
 * HomePage never re-shows this), update the store user, then act on the chosen
 * starting point. "Skip" persists a default profile and goes Home.
 */
export function OnboardingFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const [goal, setGoal] = useState<Goal>();
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>();
  const [daysPerWeek, setDaysPerWeek] = useState<number>(DEFAULT_DAYS);
  const [availableEquipment, setAvailableEquipment] = useState<EquipmentType[]>([]);
  const [startChoice, setStartChoice] = useState<StartChoice>();
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  // The store user must be updated on every success so `onboardedAt` is present
  // and the HomePage gate won't re-show this flow. Routing differs per action,
  // so it's handled by each `mutate` call's own onSuccess below.
  const saveMutation = useMutation({
    mutationFn: (profile: UserProfile) => saveProfile(profile),
    onSuccess: (user) => setUser(user),
  });

  const buildProfile = (): UserProfile => {
    const profile: UserProfile = {
      goal: goal ?? DEFAULT_GOAL,
      experienceLevel: experienceLevel ?? DEFAULT_EXPERIENCE,
      daysPerWeek,
    };
    if (availableEquipment.length > 0) profile.availableEquipment = availableEquipment;
    return profile;
  };

  const finish = () => {
    if (!startChoice) return;
    const choice = startChoice;
    saveMutation.mutate(buildProfile(), {
      onSuccess: () => {
        if (choice === 'ai') navigate(ROUTES.generate);
        else if (choice === 'build') navigate(ROUTES.planNew);
        else setShowPresetPicker(true);
      },
    });
  };

  const skip = () => {
    saveMutation.mutate(buildProfile(), {
      onSuccess: () => navigate(ROUTES.home),
    });
  };

  const goalChoices: Choice<Goal>[] = GOAL_OPTIONS.map((value) => ({ value, label: t(`ai.goal.${value}`) }));
  const experienceChoices: Choice<ExperienceLevel>[] = EXPERIENCE_OPTIONS.map((value) => ({
    value,
    label: t(`ai.experience.${value}`),
  }));
  const daysChoices: Choice<string>[] = DAYS_OPTIONS.map((n) => ({ value: String(n), label: String(n) }));
  const equipmentChoices: Choice<EquipmentType>[] = EQUIPMENT_OPTIONS.map((value) => ({
    value,
    label: t(`exercises.equipment.${value}`),
  }));
  const startChoices: Choice<StartChoice>[] = [
    { value: 'ai', label: t('onboarding.startAi'), desc: t('onboarding.startAiDesc') },
    { value: 'preset', label: t('onboarding.startPreset'), desc: t('onboarding.startPresetDesc') },
    { value: 'build', label: t('onboarding.startBuild'), desc: t('onboarding.startBuildDesc') },
  ];

  const steps: WizardStep[] = [
    {
      title: t('onboarding.welcomeTitle'),
      subtitle: t('onboarding.welcomeBody'),
      content: (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
            <SparklesIcon width={30} height={30} />
          </span>
          <p className="text-sm text-text-secondary">{t('onboarding.welcomeBody')}</p>
        </div>
      ),
    },
    {
      title: t('onboarding.profileTitle'),
      subtitle: t('onboarding.profileSubtitle'),
      valid: goal != null && experienceLevel != null && daysPerWeek >= 1,
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
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('ai.daysLabel')}</span>
            <ChoiceChips
              options={daysChoices}
              value={String(daysPerWeek)}
              onChange={(next) => setDaysPerWeek(Number(next as string))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">
              {t('builder.equipment')} <span className="text-text-muted">· {t('wizard.optional')}</span>
            </span>
            <ChoiceChips
              options={equipmentChoices}
              value={availableEquipment}
              onChange={(next) => setAvailableEquipment(next as EquipmentType[])}
              multiple
            />
          </div>
        </div>
      ),
    },
    {
      title: t('onboarding.startTitle'),
      subtitle: t('onboarding.startSubtitle'),
      valid: startChoice != null,
      content: (
        <div className="flex flex-col gap-2">
          <OptionCards options={startChoices} value={startChoice} onChange={setStartChoice} />
        </div>
      ),
    },
  ];

  if (showPresetPicker) {
    return (
      <FadeIn className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-text">{t('onboarding.startPreset')}</h1>
          <p className="text-sm text-text-secondary">{t('onboarding.startPresetDesc')}</p>
        </div>
        <PresetPicker onCreated={() => navigate(ROUTES.home)} />
      </FadeIn>
    );
  }

  return (
    <FadeIn className="flex flex-col gap-4 p-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={skip} disabled={saveMutation.isPending}>
          {t('onboarding.skip')}
        </Button>
      </div>
      <Card variant="flat">
        <Wizard
          steps={steps}
          onComplete={finish}
          finishLabel={t('common.save')}
          submitting={saveMutation.isPending}
        />
      </Card>
    </FadeIn>
  );
}
