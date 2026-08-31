import { useTranslation } from 'react-i18next';
import type { MealDay } from '@gigaflow/shared';
import { MacroBar } from '../../components/MacroBar';
import { Card } from '../../components/Card';
import { resolveTranslatable } from '../../lib/i18n';

export interface MealDayViewProps {
  day: MealDay;
}

/** A single day of a meal plan: day header, day-total MacroBar, then each meal
 * (mealType badge, resolved name, calories + macros, ingredients). Stacked
 * per-day by the caller — no day-selector state here. */
export function MealDayView({ day }: MealDayViewProps) {
  const { t, i18n } = useTranslation();

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-text">{t('meal.dayLabel', { n: day.dayIndex })}</h3>

      <MacroBar
        calories={day.totalCalories}
        proteinG={day.totalProteinG}
        carbsG={day.totalCarbsG}
        fatG={day.totalFatG}
      />

      <div className="flex flex-col gap-2">
        {day.meals.map((meal, index) => (
          <div
            key={`${meal.mealType}-${index}`}
            className="flex flex-col gap-1 rounded-[10px] border border-border-subtle p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex min-h-6 items-center rounded-full bg-surface-elevated px-2 text-xs text-text-secondary">
                {t(`meal.mealType.${meal.mealType}`)}
              </span>
              <span className="tnum text-sm font-semibold text-text">
                {meal.calories} <span className="text-xs font-normal text-text-muted">kcal</span>
              </span>
            </div>
            <span className="text-sm font-medium text-text">{resolveTranslatable(meal.name, i18n.language)}</span>
            <span className="tnum text-xs text-text-secondary">
              {t('meal.proteinShort')} {meal.proteinG}g · {t('meal.carbsShort')} {meal.carbsG}g ·{' '}
              {t('meal.fatShort')} {meal.fatG}g
            </span>
            <span className="text-xs text-text-muted">{meal.ingredients.join(', ')}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
