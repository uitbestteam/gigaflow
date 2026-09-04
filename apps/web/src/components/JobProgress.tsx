import { useTranslation } from 'react-i18next';
import { CheckIcon } from './icons';

export type JobProgressStatus = 'submitting' | 'polling' | 'done' | 'error';

export interface JobProgressProps {
  status: JobProgressStatus;
  error?: string;
  className?: string;
}

/**
 * A spinning neon-gradient orb paired with a localized status line for an
 * async job (AI generation, InBody analysis, etc). Shows the error text when
 * `status` is 'error'; 'done' renders a short celebratory confirmation line.
 * The orb carries `role="status"` so assistive tech announces progress the
 * same way the previous plain Spinner did.
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
      <div className={`${classes} animate-pop`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grad-primary shadow-glow-accent">
          <CheckIcon className="text-white" width={16} height={16} />
        </span>
        <span className="text-sm font-medium text-text">{t('job.done')}</span>
      </div>
    );
  }

  const label = status === 'submitting' ? t('job.submitting') : t('job.polling');

  return (
    <div className={classes}>
      <span className="relative h-10 w-10 shrink-0 rounded-full animate-pulse-glow motion-reduce:animate-none">
        <span
          role="status"
          aria-label={label}
          className="block h-full w-full animate-spin rounded-full bg-grad-primary [animation-duration:1s] motion-reduce:animate-none"
        >
          <span className="absolute inset-[3px] rounded-full bg-surface" />
        </span>
      </span>
      <span className="text-sm font-medium text-text-secondary">{label}</span>
    </div>
  );
}
