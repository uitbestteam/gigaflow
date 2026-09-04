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
  const classes = ['flex flex-nowrap gap-2 overflow-x-auto pb-1', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="group">
      {options.map((option) => {
        const selected = option.value === value;
        const chipClasses = [
          'inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill px-4 text-sm font-semibold',
          'transition-all duration-150 active:scale-[0.97]',
          selected
            ? 'bg-grad-primary text-white shadow-glow-accent'
            : 'bg-surface-2 text-text-secondary hover:bg-surface-3',
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
