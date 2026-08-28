import { useTranslation } from 'react-i18next';

export interface SummaryRowProps {
  name: string;
  setCount: number;
  avgWeightKg: number;
  hasPR: boolean;
  className?: string;
}

export function SummaryRow({ name, setCount, avgWeightKg, hasPR, className = '' }: SummaryRowProps) {
  const { t } = useTranslation();

  const classes = ['flex items-center justify-between gap-3 py-2', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="flex flex-col">
        <span className="font-medium text-text">{name}</span>
        <span className="tnum text-sm text-text-secondary">
          {t('summary.setsAvg', { count: setCount, avg: avgWeightKg })}
        </span>
      </div>
      {hasPR && (
        <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning">
          {t('summary.prBadge')}
        </span>
      )}
    </div>
  );
}
