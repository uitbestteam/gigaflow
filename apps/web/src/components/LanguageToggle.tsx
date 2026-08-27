export type LanguageCode = 'en' | 'vi';

export interface LanguageToggleProps {
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
  className?: string;
}

/**
 * Controlled toggle stub for switching between English and Vietnamese.
 * i18n wiring (react-i18next) lands in a later task — this component only
 * reports the requested next language via `onChange`; it does not import
 * or invoke i18next itself.
 */
export function LanguageToggle({ value, onChange, className = '' }: LanguageToggleProps) {
  const next: LanguageCode = value === 'en' ? 'vi' : 'en';
  const classes = [
    'inline-flex items-center justify-center min-h-11 min-w-11 px-3',
    'rounded-[10px] bg-surface-elevated text-text-secondary font-medium uppercase',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role="button"
      aria-label={`Switch to ${next}`}
      className={classes}
      onClick={() => onChange(next)}
    >
      {next}
    </button>
  );
}
