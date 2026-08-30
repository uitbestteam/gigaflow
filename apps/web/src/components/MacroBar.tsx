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
 * A labeled row of the four core nutrition numbers. Presentational only —
 * localization of the labels is left to callers via i18n keys elsewhere,
 * so this keeps short static labels suitable across both locales.
 */
export function MacroBar({ calories, proteinG, carbsG, fatG, className = '' }: MacroBarProps) {
  const entries: MacroEntry[] = [
    { key: 'calories', label: 'Cal', value: calories, unit: 'kcal' },
    { key: 'protein', label: 'Protein', value: proteinG, unit: 'g' },
    { key: 'carbs', label: 'Carbs', value: carbsG, unit: 'g' },
    { key: 'fat', label: 'Fat', value: fatG, unit: 'g' },
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
