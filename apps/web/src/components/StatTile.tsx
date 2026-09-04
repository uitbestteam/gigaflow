import type { ReactNode } from 'react';

export type StatTileAccent = 'primary' | 'push' | 'pull' | 'legs' | 'core';

const ACCENT_BAR_CLASSES: Record<StatTileAccent, string> = {
  primary: 'bg-grad-primary',
  push: 'bg-grad-push',
  pull: 'bg-grad-pull',
  legs: 'bg-grad-legs',
  core: 'bg-grad-core',
};

const ACCENT_ICON_CLASSES: Record<StatTileAccent, string> = {
  primary: 'text-accent',
  push: 'text-push',
  pull: 'text-pull',
  legs: 'text-legs',
  core: 'text-core',
};

export interface StatTileProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Neon accent used for the top hairline + icon color. Defaults to the primary gradient. */
  accent?: StatTileAccent;
  /** Optional leading icon (from `icons.tsx`), tinted to match `accent`. */
  icon?: ReactNode;
  className?: string;
}

/**
 * A vibrant Card-like tile for a single labeled stat (e.g. calories, weight).
 * The value uses `tnum` so digits stay a fixed width across re-renders. A
 * thin gradient hairline + tinted icon give each tile its own accent color
 * without a full gradient fill (keeps a grid of these calm, not noisy).
 */
export function StatTile({ label, value, unit, accent = 'primary', icon, className = '' }: StatTileProps) {
  const classes = [
    'relative overflow-hidden rounded-lg border border-border-subtle bg-surface p-4 shadow-card',
    'flex flex-col gap-1.5 min-h-11',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${ACCENT_BAR_CLASSES[accent]}`} />
      <div className={`flex items-center gap-1.5 ${ACCENT_ICON_CLASSES[accent]}`}>
        {icon}
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      </div>
      <span className="tnum text-2xl font-extrabold tracking-tight text-text">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-text-muted">{unit}</span> : null}
      </span>
    </div>
  );
}
