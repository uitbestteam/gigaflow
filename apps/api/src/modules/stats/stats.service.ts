import type { PersonalRecord, StatsSummary } from '@gigaflow/shared';
import { listPerformance, countCompletedSessions } from './stats.repo.js';
import { findByIds } from '../exercise/exercise.repo.js';

export async function buildSummary(userId: string): Promise<StatsSummary> {
  const [perf, totalSessions] = await Promise.all([
    listPerformance(userId),
    countCompletedSessions(userId),
  ]);
  const totalVolume = Math.round(perf.reduce((sum, p) => sum + p.totalVolume, 0));
  return {
    totalSessions,
    totalVolume,
    totalExercises: perf.length,
    totalPrs: perf.length,
  };
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
