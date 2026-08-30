export interface SegmentedFilterOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedFilterProps<T extends string> {
  options: SegmentedFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A generic chip / segmented control. Each chip meets the ≥44px touch target. */
export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedFilterProps<T>) {
  const classes = ['flex flex-wrap gap-2', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="group">
      {options.map((option) => {
        const selected = option.value === value;
        const chipClasses = [
          'inline-flex min-h-11 items-center justify-center rounded-full px-4 font-medium transition-colors',
          selected ? 'bg-accent text-white' : 'bg-surface-elevated text-text-secondary',
        ].join(' ');

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            className={chipClasses}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
