import { useTranslation } from 'react-i18next';

export interface RirPickerOption {
  rir: number;
  emoji: string;
  labelKey: 'session.rirEasy' | 'session.rirModerate' | 'session.rirHard';
}

const OPTIONS: RirPickerOption[] = [
  { rir: 3, emoji: '🙂', labelKey: 'session.rirEasy' },
  { rir: 1, emoji: '💪', labelKey: 'session.rirModerate' },
  { rir: 0, emoji: '😮‍💨', labelKey: 'session.rirHard' },
];

export interface RirPickerProps {
  value?: number;
  onPick: (rir: number) => void;
  className?: string;
}

/**
 * Three-button RIR (reps in reserve) picker: easy/moderate/hard, mapped to
 * rir=3/1/0 respectively.
 */
export function RirPicker({ value, onPick, className = '' }: RirPickerProps) {
  const { t } = useTranslation();

  const classes = ['flex items-center gap-2', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="group" aria-label={t('session.rirLabel')}>
      {OPTIONS.map((option) => {
        const selected = value === option.rir;
        const buttonClasses = [
          'inline-flex min-h-12 min-w-12 items-center justify-center rounded-pill text-2xl',
          'transition-all duration-150 active:scale-95 motion-reduce:transition-none',
          selected ? 'bg-grad-primary shadow-glow-accent scale-105' : 'bg-surface-elevated hover:bg-surface-3',
        ].join(' ');

        return (
          <button
            key={option.rir}
            type="button"
            className={buttonClasses}
            aria-label={t(option.labelKey)}
            aria-pressed={selected}
            onClick={() => onPick(option.rir)}
          >
            {option.emoji}
          </button>
        );
      })}
    </div>
  );
}
