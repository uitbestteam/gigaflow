import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { ProgressRing } from './ProgressRing';

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
 *
 * The ring's "full" reference is the seconds value seen on mount — the
 * caller remounts this component each time a new rest period starts, so
 * that value is always the fresh countdown's starting point.
 */
export function RestTimer({ seconds, running, onToggle, onAdjust, className = '' }: RestTimerProps) {
  const { t } = useTranslation();
  const [initialSeconds] = useState(seconds);
  const total = initialSeconds > 0 ? initialSeconds : 1;
  const progress = 1 - Math.min(1, seconds / total);

  const classes = ['flex flex-col items-center gap-4', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <ProgressRing
        value={progress}
        size={148}
        strokeWidth={10}
        className={running ? 'animate-pulse-glow rounded-full' : ''}
      >
        <span
          className="tnum text-3xl font-extrabold text-text motion-reduce:transition-none"
          aria-live="polite"
        >
          {formatMmSs(seconds)}
        </span>
      </ProgressRing>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => onAdjust(-15)} aria-label="-15s">
          -15s
        </Button>
        <Button size="lg" onClick={onToggle}>
          {running ? t('session.pause') : t('session.resume')}
        </Button>
        <Button variant="ghost" onClick={() => onAdjust(15)} aria-label="+15s">
          +15s
        </Button>
      </div>
    </div>
  );
}
