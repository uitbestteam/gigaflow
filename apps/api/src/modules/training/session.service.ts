import type {
  SessionStartResult, SlotTarget, SetLog, LogSetInput, TrainingSession, ExercisePerformance,
} from '@gigaflow/shared';
import { SessionStatus } from '@gigaflow/shared';
import { getTemplateWithSlotsForUser } from '../workout/workout.repo.js';
import {
  createSession, findSessionById, replaceSetLogs, listSetLogs, updateSessionOnFinish,
  updateSessionStatus, findPerformanceMany, findPerformance, upsertPerformance,
} from './session.repo.js';
import { computeTarget, epley1RM, type LastPerf } from './progression.js';

export class SessionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'SessionError';
  }
}

async function loadOwnedInProgressSession(userId: string, sessionId: string): Promise<TrainingSession> {
  const session = await findSessionById(sessionId);
  if (!session || session.userId !== userId) throw new SessionError('Session not found', 404);
  if (session.status !== SessionStatus.IN_PROGRESS) {
    throw new SessionError('Session not in progress', 409);
  }
  return session;
}

export async function startSession(userId: string, templateId: string): Promise<SessionStartResult> {
  const found = await getTemplateWithSlotsForUser(userId, templateId);
  if (!found) throw new SessionError('Template not found', 404);
  const { slots } = found;

  const exerciseIds = slots.map((s) => s.exerciseId);
  const perfMap = await findPerformanceMany(userId, exerciseIds);

  const slotTargets: SlotTarget[] = slots.map((slot) => {
    const perf = perfMap.get(slot.exerciseId);
    const last: LastPerf | null = perf ? { sets: perf.lastSets } : null;
    const target = computeTarget(last, slot);
    const slotTarget: SlotTarget = {
      ...slot,
      weightSuggested: target.weightSuggested,
      repsSuggested: target.repsSuggested,
    };
    if (perf) slotTarget.lastSets = perf.lastSets;
    return slotTarget;
  });

  const session = await createSession(userId, templateId);
  return { session, slots: slotTargets };
}

export async function logSets(
  userId: string, sessionId: string, sets: LogSetInput[],
): Promise<SetLog[]> {
  await loadOwnedInProgressSession(userId, sessionId);
  return replaceSetLogs(sessionId, sets);
}

export async function finishSession(userId: string, sessionId: string): Promise<TrainingSession> {
  const session = await loadOwnedInProgressSession(userId, sessionId);
  const setLogs = await listSetLogs(sessionId);
  const completed = setLogs.filter((s) => s.isCompleted);

  const totalSets = completed.length;
  const totalVolume = completed.reduce((sum, s) => sum + s.weightKg * s.repsDone, 0);
  const now = new Date();
  const elapsedSeconds = (now.getTime() - session.startedAt.getTime()) / 1000;
  const durationSeconds = Math.round(Math.max(0, elapsedSeconds - (session.pausedDurationSeconds ?? 0)));

  const exerciseIds = [...new Set(completed.map((s) => s.exerciseId))];
  for (const exerciseId of exerciseIds) {
    const exerciseSets = completed.filter((s) => s.exerciseId === exerciseId);
    await refreshPerformance(userId, exerciseId, exerciseSets, now);
  }

  return updateSessionOnFinish(sessionId, {
    status: SessionStatus.COMPLETED,
    finishedAt: now,
    durationSeconds,
    totalVolume,
    totalSets,
  });
}

async function refreshPerformance(
  userId: string,
  exerciseId: string,
  exerciseSets: SetLog[],
  now: Date,
): Promise<void> {
  const lastSets = exerciseSets.map((s) => {
    const perfSet: { weightKg: number; repsDone: number; rir?: number } = {
      weightKg: s.weightKg,
      repsDone: s.repsDone,
    };
    if (s.rir !== undefined) perfSet.rir = s.rir;
    return perfSet;
  });

  let sessionBest = lastSets[0] ?? null;
  let sessionBestE1RM = sessionBest ? epley1RM(sessionBest.weightKg, sessionBest.repsDone) : 0;
  for (const set of lastSets) {
    const e1RM = epley1RM(set.weightKg, set.repsDone);
    if (e1RM > sessionBestE1RM) {
      sessionBest = set;
      sessionBestE1RM = e1RM;
    }
  }

  const prior = await findPerformance(userId, exerciseId);
  const priorE1RM = prior ? prior.bestSet.e1RM : -1;
  const bestSet = sessionBestE1RM >= priorE1RM && sessionBest
    ? { weightKg: sessionBest.weightKg, repsDone: sessionBest.repsDone, e1RM: sessionBestE1RM }
    : (prior?.bestSet ?? { weightKg: 0, repsDone: 0, e1RM: 0 });

  const sessionVolume = exerciseSets.reduce((sum, s) => sum + s.weightKg * s.repsDone, 0);
  const totalVolume = (prior?.totalVolume ?? 0) + sessionVolume;
  const totalSessions = (prior?.totalSessions ?? 0) + 1;

  await upsertPerformance(userId, exerciseId, {
    lastSets,
    lastPerformedAt: now,
    bestSet,
    totalVolume,
    totalSessions,
  });
}

export async function cancelSession(userId: string, sessionId: string): Promise<TrainingSession> {
  await loadOwnedInProgressSession(userId, sessionId);
  return updateSessionStatus(sessionId, SessionStatus.CANCELLED);
}

export async function lastForExercise(
  userId: string, exerciseId: string,
): Promise<ExercisePerformance | null> {
  return findPerformance(userId, exerciseId);
}
