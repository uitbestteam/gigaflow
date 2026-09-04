import { useTranslation } from 'react-i18next';
import { FlameIcon } from './icons';

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
  /** Vivid, distinct fill color per macro so the bars read at a glance. */
  barClass: string;
}

/**
 * A calories headline plus three vividly color-coded, proportion-scaled bars
 * for protein/carbs/fat. Labels are localized (`macro.*` i18n keys); the unit
 * symbols ("kcal"/"g") are left as-is since they are locale-neutral
 * abbreviations. Bar widths animate on mount/update via a CSS transition.
 */
export function MacroBar({ calories, proteinG, carbsG, fatG, className = '' }: MacroBarProps) {
  const { t } = useTranslation();

  const macros: MacroEntry[] = [
    { key: 'protein', label: t('macro.protein'), value: proteinG, barClass: 'bg-neon-blue' },
    { key: 'carbs', label: t('macro.carbs'), value: carbsG, barClass: 'bg-legs' },
    { key: 'fat', label: t('macro.fat'), value: fatG, barClass: 'bg-neon-magenta' },
  ];
  const totalG = macros.reduce((sum, macro) => sum + macro.value, 0) || 1;

  const classes = ['flex flex-col gap-3 min-h-11', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="flex items-center gap-2 rounded-[10px] bg-surface-elevated px-3 py-2">
        <FlameIcon className="shrink-0 text-warning" width={18} height={18} />
        <span className="text-xs text-text-secondary">{t('macro.calories')}</span>
        <span className="tnum ml-auto text-base font-semibold text-text">
          {calories}
          <span className="ml-0.5 text-xs font-normal text-text-muted">kcal</span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {macros.map((macro) => (
          <div key={macro.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{macro.label}</span>
              <span className="tnum font-semibold text-text">
                {macro.value}
                <span className="ml-0.5 font-normal text-text-muted">g</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-3">
              <div
                className={`h-full rounded-pill ${macro.barClass} transition-[width] duration-700 ease-out`}
                style={{ width: `${Math.min(100, (macro.value / totalG) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
