import { useEffect, useRef, useState } from 'react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 250;

/**
 * A controlled-locally, debounced search input. The input's own display
 * value updates immediately on every keystroke; `onChange` is called with
 * the debounced value ~250ms after the user stops typing, via a plain
 * `setTimeout` (fake-timer friendly for tests).
 */
export function SearchInput({ value, onChange, placeholder, className = '' }: SearchInputProps) {
  const [text, setText] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // External resync (e.g. a "clear filters" action): adopt the new value
    // immediately and cancel any keystroke-driven debounce still pending,
    // so a stale onChange(prevText) can't fire later and clobber this reset.
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    setText(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  function handleChange(next: string) {
    setText(next);
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      onChange(next);
    }, DEBOUNCE_MS);
  }

  const classes = [
    'min-h-11 w-full rounded-pill bg-surface-2 px-4 text-[15px] text-text',
    'placeholder:text-text-muted border border-border-subtle',
    'transition-colors focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/30',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative">
      <svg
        aria-hidden="true"
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={[classes, 'pl-10'].join(' ')}
      />
    </div>
  );
}
