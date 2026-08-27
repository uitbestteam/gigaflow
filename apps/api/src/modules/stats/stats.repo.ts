import { type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import type { ExercisePerformance } from '@gigaflow/shared';

const PERFORMANCE_COLLECTION = 'exercise_performance';
const SESSIONS_COLLECTION = 'training_sessions';

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
