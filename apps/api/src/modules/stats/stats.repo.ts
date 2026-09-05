import { type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import type { ExercisePerformance } from '@gigaflow/shared';

const PERFORMANCE_COLLECTION = 'exercise_performance';
const SESSIONS_COLLECTION = 'training_sessions';
const SET_LOGS_COLLECTION = 'set_logs';
const MEAL_PLANS_COLLECTION = 'meal_plans';

function performanceCollection() {
  return getDb().collection(PERFORMANCE_COLLECTION);
}

function sessionsCollection() {
  return getDb().collection(SESSIONS_COLLECTION);
}

function toExercisePerformance(doc: WithId<Document>): ExercisePerformance {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as Omit<ExercisePerformance, 'id'>) };
}

export async function listPerformance(userId: string): Promise<ExercisePerformance[]> {
  const docs = await performanceCollection().find({ userId }).toArray();
  return docs.map(toExercisePerformance);
}

export async function countCompletedSessions(userId: string): Promise<number> {
  return sessionsCollection().countDocuments({ userId, status: 'completed' });
}

/** Count of meal plans the user has generated (for the first-meal-plan award). */
export async function countMealPlans(userId: string): Promise<number> {
  return getDb().collection(MEAL_PLANS_COLLECTION).countDocuments({ userId });
}

/**
 * Completion dates of the user's finished (`completed`) sessions — the
 * `finishedAt` timestamp, falling back to `startedAt` for older rows that
 * never recorded a finish time. Used by the streak calculation.
 */
export async function listFinishedSessionDates(userId: string): Promise<Date[]> {
  const docs = await sessionsCollection()
    .find({ userId, status: 'completed' }, { projection: { finishedAt: 1, startedAt: 1 } })
    .toArray();
  return docs.map((d) => (d.finishedAt ?? d.startedAt) as Date);
}

/** One completed set from a finished session, tagged with the session's week date. */
export interface FinishedSetVolume {
  weekDate: Date;
  exerciseId: string;
  volume: number;
}

/**
 * Every completed set that belongs to a finished session, with per-set volume
 * (`weightKg * repsDone`) and the owning session's completion date. The
 * exercise → muscle-group join is resolved in the service layer (mirroring
 * `buildPersonalRecords`) so we never coerce possibly-invalid id strings to
 * ObjectId inside the pipeline.
 */
export async function listFinishedSetVolumes(userId: string): Promise<FinishedSetVolume[]> {
  const docs = await sessionsCollection()
    .aggregate([
      { $match: { userId, status: 'completed' } },
      {
        $addFields: {
          sid: { $toString: '$_id' },
          weekDate: { $ifNull: ['$finishedAt', '$startedAt'] },
        },
      },
      { $lookup: { from: SET_LOGS_COLLECTION, localField: 'sid', foreignField: 'sessionId', as: 'sets' } },
      { $unwind: '$sets' },
      { $match: { 'sets.isCompleted': true } },
      {
        $project: {
          _id: 0,
          weekDate: 1,
          exerciseId: '$sets.exerciseId',
          volume: { $multiply: ['$sets.weightKg', '$sets.repsDone'] },
        },
      },
    ])
    .toArray();
  return docs.map((d) => ({
    weekDate: d.weekDate as Date,
    exerciseId: d.exerciseId as string,
    volume: d.volume as number,
  }));
}
