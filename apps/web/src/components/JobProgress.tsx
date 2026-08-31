import { useTranslation } from 'react-i18next';
import { Spinner } from './Spinner';

export type JobProgressStatus = 'submitting' | 'polling' | 'done' | 'error';

export interface JobProgressProps {
  status: JobProgressStatus;
  error?: string;
  className?: string;
}

/**
 * A Spinner paired with a localized status line for an async job (AI
 * generation, InBody analysis, etc). Shows the error text when `status` is
 * 'error'; 'done' renders a short confirmation line.
 */
export function JobProgress({ status, error, className = '' }: JobProgressProps) {
  const { t } = useTranslation();

  const classes = ['flex items-center gap-3 min-h-11', className].filter(Boolean).join(' ');

  if (status === 'error') {
    return (
      <div className={classes}>
        <span className="text-sm text-warning">{error ?? t('job.polling')}</span>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className={classes}>
        <span className="text-sm text-text-secondary">{t('job.done')}</span>
      </div>
    );
  }

  const label = status === 'submitting' ? t('job.submitting') : t('job.polling');

  return (
    <div className={classes}>
      <Spinner />
      <span className="text-sm text-text-secondary">{label}</span>
    </div>
  );
}
