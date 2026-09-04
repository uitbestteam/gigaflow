import type { ReactNode } from 'react';

export interface ProgressRingProps {
  /** 0–1 progress. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: ReactNode;
}

/**
 * Circular progress with a neon gradient stroke. `children` render centered
 * (e.g. a percentage or count). The gradient id is unique per render to allow
 * multiple rings on one page.
 */
export function ProgressRing({
  value,
  size = 72,
  strokeWidth = 7,
  className = '',
  children,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * clamped;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      {children != null && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tnum">{children}</div>
      )}
    </div>
  );
}
