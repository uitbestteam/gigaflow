import { useTranslation } from 'react-i18next';
import { SparklesIcon } from './icons';

export interface SummaryRowProps {
  name: string;
  setCount: number;
  avgWeightKg: number;
  hasPR: boolean;
  className?: string;
}

export function SummaryRow({ name, setCount, avgWeightKg, hasPR, className = '' }: SummaryRowProps) {
  const { t } = useTranslation();

  const classes = ['flex items-center justify-between gap-3 py-3', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="flex flex-col">
        <span className="font-semibold text-text">{name}</span>
        <span className="tnum text-sm text-text-secondary">
          {t('summary.setsAvg', { count: setCount, avg: avgWeightKg })}
        </span>
      </div>
      {hasPR && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-grad-primary px-2.5 py-1 text-xs font-bold text-white shadow-glow-accent">
          <SparklesIcon width={12} height={12} />
          {t('summary.prBadge')}
        </span>
      )}
    </div>
  );
}
