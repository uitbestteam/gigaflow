export interface SpinnerProps {
  className?: string;
  label?: string;
}

/**
 * A spin animation indicator. The `motion-reduce:animate-none` class
 * disables the spin animation when the user has `prefers-reduced-motion`
 * enabled, leaving a static ring instead.
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
