import { useTranslation } from 'react-i18next';
import type { VolumeByWeek } from '@gigaflow/shared';

export interface VolumeByMuscleChartProps {
  data: VolumeByWeek[];
}

const CHART_HEIGHT = 140;
const BAR_WIDTH = 30;
const BAR_GAP = 16;
const TOP_PAD = 8;

/** Muscle group → flat identity color token (push/pull/legs/core). Unknown
 * groups fall back to the primary accent. */
const MUSCLE_COLOR: Record<string, string> = {
  chest: 'var(--push)',
  shoulders: 'var(--push)',
  back: 'var(--pull)',
  arms: 'var(--pull)',
  legs: 'var(--legs)',
  core: 'var(--core)',
  cardio: 'var(--core)',
};
const FALLBACK_COLOR = 'var(--accent)';
const KNOWN_MUSCLES = new Set(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio']);

function muscleColor(group: string): string {
  return MUSCLE_COLOR[group] ?? FALLBACK_COLOR;
}

function shortDate(value: Date): string {
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Stacked bar chart of weekly training volume, one bar per ISO week and one
 * flat-colored segment per muscle group. Renders a localized empty state (no
 * SVG) when there is no data, and respects reduced motion by construction
 * (segments render at their final size, no animation loop).
 */
export function VolumeByMuscleChart({ data }: VolumeByMuscleChartProps) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border-subtle text-sm text-text-muted">
        {t('stats.noData')}
      </div>
    );
  }

  const muscleLabel = (group: string): string =>
    KNOWN_MUSCLES.has(group) ? t(`exercises.muscle.${group}`) : group;

  const maxTotal = data.reduce((acc, w) => Math.max(acc, w.total), 0);
  const safeMax = maxTotal > 0 ? maxTotal : 1;
  const width = data.length * (BAR_WIDTH + BAR_GAP);
  const usableHeight = CHART_HEIGHT - TOP_PAD;

  // Stable legend: every muscle group that appears in any week, first-seen order.
  const legendGroups: string[] = [];
  for (const week of data) {
    for (const group of Object.keys(week.byMuscleGroup)) {
      if (!legendGroups.includes(group)) legendGroups.push(group);
    }
  }

  const chartTitle = t('stats.volumeByMuscleTitle');

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={chartTitle}
          width={width}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        >
          <title>{chartTitle}</title>
          {data.map((week, index) => {
            const x = index * (BAR_WIDTH + BAR_GAP);
            const weekKey = week.weekStart instanceof Date ? week.weekStart.toISOString() : String(week.weekStart);
            // Stack segments bottom-up in the legend order for visual stability.
            let cursorY = CHART_HEIGHT;
            return (
              <g key={weekKey}>
                {legendGroups.map((group) => {
                  const value = week.byMuscleGroup[group] ?? 0;
                  if (value <= 0) return null;
                  const segHeight = (value / safeMax) * usableHeight;
                  cursorY -= segHeight;
                  return (
                    <rect
                      key={`${weekKey}-${group}`}
                      x={x}
                      y={cursorY}
                      width={BAR_WIDTH}
                      height={segHeight}
                      fill={muscleColor(group)}
                    >
                      <title>
                        {muscleLabel(group)}: {value}kg
                      </title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex text-[10px] font-medium text-text-muted" style={{ width }}>
          {data.map((week, index) => {
            const label = week.weekStart instanceof Date ? shortDate(week.weekStart) : shortDate(new Date(week.weekStart));
            return (
              <span
                key={`label-${index}`}
                className="text-center"
                style={{ width: BAR_WIDTH + BAR_GAP }}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {legendGroups.map((group) => (
          <li key={group} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: muscleColor(group) }}
            />
            {muscleLabel(group)}
          </li>
        ))}
      </ul>
    </div>
  );
}
