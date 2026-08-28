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
    'min-h-11 w-full rounded-[10px] bg-surface-elevated px-3 text-text',
    'placeholder:text-text-muted border border-border-subtle',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <input
      type="search"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className={classes}
    />
  );
}
