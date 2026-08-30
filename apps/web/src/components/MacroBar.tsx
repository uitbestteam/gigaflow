import { useTranslation } from 'react-i18next';

export interface MacroBarProps {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  className?: string;
}

interface MacroEntry {
  key: string;
  label: string;
  value: number;
  unit: string;
}

/**
 * A labeled row of the four core nutrition numbers. Labels are localized
 * (`macro.*` i18n keys); the unit symbols ("kcal"/"g") are left as-is since
 * they are locale-neutral abbreviations.
 */
export function MacroBar({ calories, proteinG, carbsG, fatG, className = '' }: MacroBarProps) {
  const { t } = useTranslation();

  const entries: MacroEntry[] = [
    { key: 'calories', label: t('macro.calories'), value: calories, unit: 'kcal' },
    { key: 'protein', label: t('macro.protein'), value: proteinG, unit: 'g' },
    { key: 'carbs', label: t('macro.carbs'), value: carbsG, unit: 'g' },
    { key: 'fat', label: t('macro.fat'), value: fatG, unit: 'g' },
  ];

  const classes = ['flex items-stretch gap-2 min-h-11', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-surface-elevated px-2 py-2"
        >
          <span className="text-xs text-text-secondary">{entry.label}</span>
          <span className="tnum text-base font-semibold text-text">
            {entry.value}
            <span className="ml-0.5 text-xs font-normal text-text-muted">{entry.unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
