import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ActivityLevel,
  Allergen,
  Country,
  CuisineRegion,
  DietaryPattern,
  Gender,
  Goal,
  type GenerateMealInput,
  type MealPlanDoc,
} from '@gigaflow/shared';
import { generateMeal, getActiveMeal, getMealJob } from '../../lib/api';
import { useJobPolling } from '../../lib/useJobPolling';
import { JobProgress } from '../../components/JobProgress';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Wizard, type WizardStep } from '../../components/Wizard';
import { ChoiceChips, OptionCards, Select, type Choice } from '../../components/form';
import { FadeIn, Stagger, StaggerItem } from '../../components/motion';
import { UtensilsIcon } from '../../components/icons';
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
const REGION_OPTIONS: CuisineRegion[] = [
  CuisineRegion.EAST_ASIAN,
  CuisineRegion.SOUTHEAST_ASIAN,
  CuisineRegion.SOUTH_ASIAN,
  CuisineRegion.WESTERN,
  CuisineRegion.MEDITERRANEAN,
  CuisineRegion.LATIN_AMERICAN,
  CuisineRegion.MIDDLE_EASTERN,
];
const COUNTRY_OPTIONS: Country[] = [
  Country.VIETNAM,
  Country.THAILAND,
  Country.JAPAN,
  Country.KOREA,
  Country.CHINA,
  Country.INDIA,
  Country.INDONESIA,
  Country.USA,
  Country.UK,
  Country.ITALY,
  Country.FRANCE,
  Country.SPAIN,
  Country.GREECE,
  Country.MEXICO,
  Country.BRAZIL,
  Country.TURKEY,
];
const DIET_OPTIONS: DietaryPattern[] = [
  DietaryPattern.OMNIVORE,
  DietaryPattern.VEGETARIAN,
  DietaryPattern.VEGAN,
  DietaryPattern.PESCATARIAN,
  DietaryPattern.HALAL,
  DietaryPattern.KETO,
  DietaryPattern.LOW_CARB,
];
const ALLERGEN_OPTIONS: Allergen[] = [
  Allergen.PEANUTS,
  Allergen.TREE_NUTS,
  Allergen.SHELLFISH,
  Allergen.FISH,
  Allergen.EGGS,
  Allergen.DAIRY,
  Allergen.GLUTEN,
  Allergen.SOY,
  Allergen.SESAME,
];
const MEALS_PER_DAY_OPTIONS = [3, 4, 5] as const;

/** AI-generated meal plan page (spec §4.4): shows the active plan if one
 * exists, otherwise a multi-step wizard collects intake and kicks off
 * generation with a job-polling loop, then the resulting plan is shown. */
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
  const [cuisineRegion, setCuisineRegion] = useState<CuisineRegion>();
  const [cuisineCountry, setCuisineCountry] = useState<Country>();
  const [dietaryPattern, setDietaryPattern] = useState<DietaryPattern>();
  const [allergies, setAllergies] = useState<Allergen[]>([]);
  const [avoidFoods, setAvoidFoods] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState<number>();

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
    const input: GenerateMealInput = { goal, gender, age, heightCm, weightKg, activityLevel };
    if (cuisineRegion) input.cuisineRegion = cuisineRegion;
    if (cuisineCountry) input.cuisineCountry = cuisineCountry;
    if (dietaryPattern) input.dietaryPattern = dietaryPattern;
    if (allergies.length > 0) input.allergies = allergies;
    const trimmed = avoidFoods.trim();
    if (trimmed) input.avoidFoods = trimmed;
    if (mealsPerDay) input.mealsPerDay = mealsPerDay;
    void run(input);
  };

  const plan = status === 'done' && result !== undefined ? result : activeMealQuery.data;

  const goalChoices: Choice<Goal>[] = GOAL_OPTIONS.map((value) => ({ value, label: t(`meal.goal.${value}`) }));
  const genderChoices: Choice<Gender>[] = GENDER_OPTIONS.map((value) => ({
    value,
    label: t(`meal.gender.${value}`),
  }));
  const activityChoices: Choice<ActivityLevel>[] = ACTIVITY_OPTIONS.map((value) => ({
    value,
    label: t(`meal.activity.${value}`),
  }));
  const regionChoices: Choice<CuisineRegion>[] = REGION_OPTIONS.map((value) => ({
    value,
    label: t(`meal.cuisineRegion.${value}`),
  }));
  const countryChoices = COUNTRY_OPTIONS.map((value) => ({ value, label: t(`meal.country.${value}`) }));
  const dietChoices: Choice<DietaryPattern>[] = DIET_OPTIONS.map((value) => ({
    value,
    label: t(`meal.dietaryPattern.${value}`),
  }));
  const allergenChoices: Choice<Allergen>[] = ALLERGEN_OPTIONS.map((value) => ({
    value,
    label: t(`meal.allergen.${value}`),
  }));
  const mealsPerDayChoices: Choice<string>[] = MEALS_PER_DAY_OPTIONS.map((n) => ({
    value: String(n),
    label: String(n),
  }));

  const numberField = (label: string, value: number, onChange: (n: number) => void, min: number, max?: number) => (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <input
        type="number"
        min={min}
        {...(max != null ? { max } : {})}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 max-w-[8rem] rounded-[10px] border border-border bg-surface px-3 text-text"
      />
    </label>
  );

  const steps: WizardStep[] = [
    {
      title: t('meal.stepGoalTitle'),
      subtitle: t('meal.stepGoalSubtitle'),
      content: (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-text-secondary">{t('meal.goalLabel')}</span>
          <OptionCards options={goalChoices} value={goal} onChange={setGoal} />
        </div>
      ),
    },
    {
      title: t('meal.stepBodyTitle'),
      subtitle: t('meal.stepBodySubtitle'),
      valid: age > 0 && heightCm > 0 && weightKg > 0,
      content: (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('meal.genderLabel')}</span>
            <ChoiceChips options={genderChoices} value={gender} onChange={(next) => setGender(next as Gender)} />
          </div>
          {numberField(t('meal.ageLabel'), age, setAge, 10, 100)}
          {numberField(t('meal.heightLabel'), heightCm, setHeightCm, 1)}
          {numberField(t('meal.weightLabel'), weightKg, setWeightKg, 1)}
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">{t('meal.activityLabel')}</span>
            <ChoiceChips
              options={activityChoices}
              value={activityLevel}
              onChange={(next) => setActivityLevel(next as ActivityLevel)}
            />
          </div>
        </div>
      ),
    },
    {
      title: t('meal.stepCuisineTitle'),
      subtitle: t('meal.stepCuisineSubtitle'),
      content: (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">
              {t('meal.cuisineRegionLabel')} <span className="text-text-muted">· {t('wizard.optional')}</span>
            </span>
            <ChoiceChips
              options={regionChoices}
              value={cuisineRegion}
              onChange={(next) =>
                setCuisineRegion((prev) => (prev === next ? undefined : (next as CuisineRegion)))
              }
            />
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">
              {t('meal.cuisineCountryLabel')} <span className="text-text-muted">· {t('wizard.optional')}</span>
            </span>
            <Select
              options={countryChoices}
              placeholder={t('meal.anyCountry')}
              value={cuisineCountry ?? ''}
              onChange={(event) => setCuisineCountry((event.target.value || undefined) as Country | undefined)}
            />
          </label>
        </div>
      ),
    },
    {
      title: t('meal.stepDietTitle'),
      subtitle: t('meal.stepDietSubtitle'),
      content: (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">
              {t('meal.dietaryPatternLabel')} <span className="text-text-muted">· {t('wizard.optional')}</span>
            </span>
            <OptionCards
              options={dietChoices}
              value={dietaryPattern}
              onChange={setDietaryPattern}
              columns={2}
            />
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-sm text-text-secondary">{t('meal.allergiesLabel')}</span>
            <ChoiceChips
              options={allergenChoices}
              value={allergies}
              onChange={(next) => setAllergies(next as Allergen[])}
              multiple
            />
            {allergies.length > 0 && (
              <Button variant="ghost" className="self-start" onClick={() => setAllergies([])}>
                {t('meal.none')}
              </Button>
            )}
          </div>
        </div>
      ),
    },
    {
      title: t('meal.stepPrefsTitle'),
      subtitle: t('meal.stepPrefsSubtitle'),
      content: (
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">
              {t('meal.dislikesLabel')} <span className="text-text-muted">· {t('wizard.optional')}</span>
            </span>
            <input
              type="text"
              maxLength={300}
              value={avoidFoods}
              placeholder={t('meal.dislikesPlaceholder')}
              onChange={(event) => setAvoidFoods(event.target.value)}
              className="min-h-11 rounded-[10px] border border-border bg-surface px-3 text-text"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary">
              {t('meal.mealsPerDayLabel')} <span className="text-text-muted">· {t('wizard.optional')}</span>
            </span>
            <ChoiceChips
              options={mealsPerDayChoices}
              value={mealsPerDay != null ? String(mealsPerDay) : undefined}
              onChange={(next) => {
                const n = Number(next as string);
                setMealsPerDay((prev) => (prev === n ? undefined : n));
              }}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 p-4">
      <FadeIn>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-grad-cyan shadow-glow-blue">
            <UtensilsIcon className="text-white" width={22} height={22} />
          </span>
          <div className="flex flex-col">
            <h1 className="text-lg font-extrabold tracking-tight text-text">{t('meal.title')}</h1>
            <p className="text-xs text-text-secondary">{t('meal.heroSubtitle')}</p>
          </div>
        </div>
      </FadeIn>

      {plan && (
        <FadeIn>
          <Card variant="glow" className="flex flex-col items-center gap-1 py-5 text-center">
            <span className="text-xs uppercase tracking-wide text-text-secondary">{t('meal.title')}</span>
            <h2 className="text-lg font-extrabold text-text">{plan.name}</h2>
          </Card>
        </FadeIn>
      )}

      {plan && (
        <Stagger className="flex flex-col gap-3">
          {plan.days.map((day) => (
            <StaggerItem key={day.dayIndex}>
              <MealDayView day={day} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {!plan && !isBusy && status !== 'error' && (
        <Card variant="flat">
          <Wizard steps={steps} onComplete={submit} finishLabel={t('meal.submit')} submitting={isBusy} />
        </Card>
      )}

      {!plan && isBusy && <JobProgress status={status} error={error} className="justify-center" />}

      {!plan && status === 'error' && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-warning">{error}</span>
          <Button variant="ghost" onClick={submit}>
            {t('common.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}
