export interface SkeletonProps {
  className?: string;
}

/** Shimmering placeholder block. Compose with width/height via `className`. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden="true" />;
}

/** A stack of skeleton lines/cards for full-page loading states. */
export function SkeletonList({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
