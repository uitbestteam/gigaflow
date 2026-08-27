export interface SpinnerProps {
  className?: string;
  label?: string;
}

/**
 * Reduced-motion-safe spinner: uses Tailwind's `animate-spin`, which is
 * automatically disabled by the browser when `prefers-reduced-motion:
 * reduce` is set (Tailwind's base layer honors this via CSS `@media`
 * override is left to global styles; here we additionally guard with
 * `motion-reduce:animate-none` so the spinner falls back to a static ring).
 */
export function Spinner({ className = '', label = 'Loading' }: SpinnerProps) {
  const classes = [
    'inline-block h-6 w-6 rounded-full',
    'border-2 border-border-subtle border-t-accent',
    'animate-spin motion-reduce:animate-none',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="status" aria-label={label} className={classes}>
      <span className="sr-only">{label}</span>
    </div>
  );
}
