import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export interface MiniBarChartPoint {
  label: string;
  value: number;
}

export interface MiniBarChartProps {
  points: MiniBarChartPoint[];
  unit?: string;
  className?: string;
}

const CHART_HEIGHT = 96;
const BAR_WIDTH = 26;
const BAR_GAP = 14;

/**
 * A minimal inline-SVG bar chart, one `<rect>` per point scaled against the
 * largest value in the set, filled with the app's neon gradient. Reduced
 * motion is respected by construction (bars render at final height directly,
 * no JS-driven animation loop). Renders a localized empty-state message (no
 * SVG) when `points` is empty, and guards a zero/negative max to avoid a
 * divide-by-zero.
 */
export function MiniBarChart({ points, unit = '', className = '' }: MiniBarChartProps) {
  const { t } = useTranslation();
  const gradId = useId();
  const wrapperClasses = ['overflow-x-auto', className].filter(Boolean).join(' ');

  if (points.length === 0) {
    return (
      <div className={wrapperClasses}>
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border-subtle text-sm text-text-muted">
          {t('stats.noData')}
        </div>
      </div>
    );
  }

  const max = points.reduce((acc, p) => Math.max(acc, p.value), 0);
  const safeMax = max > 0 ? max : 1;
  const width = points.length * (BAR_WIDTH + BAR_GAP);
  const chartTitle = t('stats.trendChart');
  const fillId = `mbc-grad-${gradId}`;

  return (
    <div className={wrapperClasses}>
      <svg
        role="img"
        aria-label={chartTitle}
        width={width}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
      >
        <title>{chartTitle}</title>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        {points.map((point, index) => {
          const barHeight = (point.value / safeMax) * (CHART_HEIGHT - 20);
          const x = index * (BAR_WIDTH + BAR_GAP);
          const y = CHART_HEIGHT - Math.max(barHeight, 1);
          return (
            <rect
              key={`${point.label}-${index}`}
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={Math.max(barHeight, 1)}
              rx={7}
              fill={`url(#${fillId})`}
              className="transition-all duration-500 ease-out motion-reduce:transition-none"
            >
              <title>
                {point.label}: {point.value}
                {unit}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex text-[10px] font-medium text-text-muted" style={{ width }}>
        {points.map((point, index) => (
          <span
            key={`${point.label}-${index}`}
            className="text-center"
            style={{ width: BAR_WIDTH + BAR_GAP }}
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
