import type { ReactNode, SelectHTMLAttributes } from 'react';

/** Labelled option shared by the choice components. */
export interface Choice<T extends string> {
  value: T;
  label: string;
  desc?: string;
  icon?: ReactNode;
}

/* ── Styled native select (dropdowns, e.g. country) ─────────────────────── */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ options, placeholder, className = '', ...rest }: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        className="min-h-11 w-full appearance-none rounded-md border border-border bg-surface-2 px-3 pr-9 text-[15px] text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        {...rest}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/* ── Toggle chips: single or multi select ───────────────────────────────── */
export interface ChoiceChipsProps<T extends string> {
  options: Choice<T>[];
  /** Currently selected value(s). Pass a T[] for multi, a T|undefined for single. */
  value: T[] | T | undefined;
  onChange: (next: T[] | T) => void;
  multiple?: boolean;
  className?: string;
}

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
  className = '',
}: ChoiceChipsProps<T>) {
  const selected = new Set<T>(Array.isArray(value) ? value : value != null ? [value] : []);

  const toggle = (v: T) => {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange([...next]);
    } else {
      onChange(v);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const active = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.value)}
            className={[
              'inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold transition-all active:scale-[0.97]',
              active
                ? 'border-accent bg-accent/15 text-text'
                : 'border-border bg-surface-2 text-text-secondary hover:border-border',
            ].join(' ')}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Big single-select cards (goal, experience, location…) ──────────────── */
export interface OptionCardsProps<T extends string> {
  options: Choice<T>[];
  value: T | undefined;
  onChange: (next: T) => void;
  columns?: 1 | 2;
  className?: string;
}

export function OptionCards<T extends string>({
  options,
  value,
  onChange,
  columns = 1,
  className = '',
}: OptionCardsProps<T>) {
  return (
    <div className={`grid gap-2.5 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'} ${className}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={[
              'flex items-start gap-3 rounded-lg border p-4 text-left transition-all active:scale-[0.99]',
              active
                ? 'border-accent bg-accent/10 shadow-card'
                : 'border-border-subtle bg-surface hover:border-border',
            ].join(' ')}
          >
            {o.icon && <span className="shrink-0 text-accent">{o.icon}</span>}
            <span className="min-w-0">
              <span className="block font-semibold text-text">{o.label}</span>
              {o.desc && <span className="mt-0.5 block text-sm text-text-secondary">{o.desc}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
