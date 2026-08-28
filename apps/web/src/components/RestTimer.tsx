import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export interface RestTimerProps {
  /** Remaining seconds; the countdown itself lives in the caller. */
  seconds: number;
  running: boolean;
  onToggle: () => void;
  onAdjust: (deltaSeconds: number) => void;
  className?: string;
}

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Pure countdown display. `seconds`/`running` are driven by the caller
 * (the interval that ticks the countdown lives on the active-session page);
 * this component only renders the state and forwards user intent.
 */
export function RestTimer({ seconds, running, onToggle, onAdjust, className = '' }: RestTimerProps) {
  const { t } = useTranslation();

  const classes = ['flex items-center gap-3', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Button variant="ghost" onClick={() => onAdjust(-15)} aria-label="-15s">
        -15s
      </Button>
      <span
        className="tnum min-w-[4ch] text-center text-2xl font-semibold text-text motion-reduce:transition-none"
        aria-live="polite"
      >
        {formatMmSs(seconds)}
      </span>
      <Button variant="ghost" onClick={() => onAdjust(15)} aria-label="+15s">
        +15s
      </Button>
      <Button onClick={onToggle}>{running ? t('session.pause') : t('session.resume')}</Button>
    </div>
  );
}
