import type { PersonalRecord, StatsSummary, VolumeByWeek } from '@gigaflow/shared';
import {
  listPerformance,
  countCompletedSessions,
  countMealPlans,
  listFinishedSessionDates,
  listFinishedSetVolumes,
} from './stats.repo.js';
import { findByIds } from '../exercise/exercise.repo.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_WEEKS = 12;

/**
 * UTC midnight of the Monday that starts the ISO calendar week containing
 * `d`, as an epoch-ms value. Working in UTC keeps week arithmetic immune to
 * DST shifts (every week is exactly `WEEK_MS`).
 */
export function isoWeekStartMs(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0=Sun … 6=Sat
  const shiftToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + shiftToMonday);
  return date.getTime();
}

/**
 * Streak stats over a set of finished-session dates.
 *  - `current`: consecutive ISO weeks ending at (and including) the week of
 *    `now`; 0 if the current week has no finished session.
 *  - `longest`: the best-ever run of consecutive weeks with a finished session.
 */
export function computeStreaks(dates: Date[], now: Date = new Date()): { current: number; longest: number } {
  const weeks = new Set<number>(dates.map(isoWeekStartMs));

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const week of [...weeks].sort((a, b) => a - b)) {
    run = prev !== null && week - prev === WEEK_MS ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = week;
  }

  let current = 0;
  let cursor = isoWeekStartMs(now);
  while (weeks.has(cursor)) {
    current += 1;
    cursor -= WEEK_MS;
  }

  return { current, longest };
}

export async function buildSummary(userId: string): Promise<StatsSummary> {
  const [perf, totalSessions, sessionDates, totalMealPlans] = await Promise.all([
    listPerformance(userId),
    countCompletedSessions(userId),
    listFinishedSessionDates(userId),
    countMealPlans(userId),
  ]);
  const totalVolume = Math.round(perf.reduce((sum, p) => sum + p.totalVolume, 0));
  const { current, longest } = computeStreaks(sessionDates);
  return {
    totalSessions,
    totalVolume,
    totalExercises: perf.length,
    totalPrs: perf.length,
    currentStreakWeeks: current,
    longestStreakWeeks: longest,
    totalMealPlans,
  };
}

/**
 * Finished-session training volume per ISO week, split by the exercise's
 * muscle group (oldest → newest, capped to the most recent {@link MAX_WEEKS}
 * weeks). Exercises that can no longer be resolved bucket under `'other'`.
 */
export async function buildVolumeByWeek(userId: string): Promise<VolumeByWeek[]> {
  const rows = await listFinishedSetVolumes(userId);
  if (rows.length === 0) return [];

  const exerciseMap = await findByIds([...new Set(rows.map((r) => r.exerciseId))]);
  const byWeek = new Map<number, Map<string, number>>();
  for (const row of rows) {
    const weekStart = isoWeekStartMs(row.weekDate);
    const muscleGroup = exerciseMap.get(row.exerciseId)?.muscleGroup ?? 'other';
    const groups = byWeek.get(weekStart) ?? new Map<string, number>();
    groups.set(muscleGroup, (groups.get(muscleGroup) ?? 0) + row.volume);
    byWeek.set(weekStart, groups);
  }

  const weekStarts = [...byWeek.keys()].sort((a, b) => a - b).slice(-MAX_WEEKS);
  return weekStarts.map((weekStart) => {
    const groups = byWeek.get(weekStart)!;
    const byMuscleGroup: Record<string, number> = {};
    let total = 0;
    for (const [muscleGroup, volume] of groups) {
      const rounded = Math.round(volume);
      byMuscleGroup[muscleGroup] = rounded;
      total += rounded;
    }
    return { weekStart: new Date(weekStart), byMuscleGroup, total };
  });
}

export async function buildPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  const perf = await listPerformance(userId);
  const exerciseMap = await findByIds(perf.map((p) => p.exerciseId));

  const records: PersonalRecord[] = perf.map((p) => {
    const exercise = exerciseMap.get(p.exerciseId);
    return {
      exerciseId: p.exerciseId,
      name: exercise ? exercise.name : { en: p.exerciseId, vi: p.exerciseId },
      bestSet: p.bestSet,
    };
  });

  return records.sort((a, b) => b.bestSet.e1RM - a.bestSet.e1RM);
}
