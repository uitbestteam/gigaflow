export interface StatTileProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
}

/**
 * A Card-like tile for a single labeled stat (e.g. calories, weight).
 * The value uses `tnum` so digits stay a fixed width across re-renders.
 */
export function StatTile({ label, value, unit, className = '' }: StatTileProps) {
  const classes = [
    'bg-surface border border-border-subtle rounded-[10px] p-4',
    'flex flex-col gap-1 min-h-11',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="tnum text-2xl font-semibold text-text">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-text-muted">{unit}</span> : null}
      </span>
    </div>
  );
}
