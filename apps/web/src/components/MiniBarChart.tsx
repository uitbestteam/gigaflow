export interface MiniBarChartPoint {
  label: string;
  value: number;
}

export interface MiniBarChartProps {
  points: MiniBarChartPoint[];
  unit?: string;
  className?: string;
}

const CHART_HEIGHT = 80;
const BAR_WIDTH = 24;
const BAR_GAP = 12;
const CHART_TITLE = 'Trend chart';

/**
 * A minimal inline-SVG bar chart, one `<rect>` per point scaled against the
 * largest value in the set. No animation is used, so there is nothing to
 * disable under `prefers-reduced-motion` — it is reduced-motion safe by
 * construction. Renders an empty-state message (no SVG) when `points` is
 * empty, and guards a zero/negative max to avoid a divide-by-zero.
 */
export function MiniBarChart({ points, unit = '', className = '' }: MiniBarChartProps) {
  const wrapperClasses = ['overflow-x-auto', className].filter(Boolean).join(' ');

  if (points.length === 0) {
    return (
      <div className={wrapperClasses}>
        <p className="text-sm text-text-muted">No data yet</p>
      </div>
    );
  }

  const max = points.reduce((acc, p) => Math.max(acc, p.value), 0);
  const safeMax = max > 0 ? max : 1;
  const width = points.length * (BAR_WIDTH + BAR_GAP);

  return (
    <div className={wrapperClasses}>
      <svg
        role="img"
        aria-label={CHART_TITLE}
        width={width}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
      >
        <title>{CHART_TITLE}</title>
        {points.map((point, index) => {
          const barHeight = (point.value / safeMax) * (CHART_HEIGHT - 16);
          const x = index * (BAR_WIDTH + BAR_GAP);
          const y = CHART_HEIGHT - barHeight;
          return (
            <rect
              key={`${point.label}-${index}`}
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={Math.max(barHeight, 1)}
              rx={4}
              className="fill-accent"
            >
              <title>
                {point.label}: {point.value}
                {unit}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
