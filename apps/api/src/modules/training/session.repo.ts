import { ObjectId, type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import {
  type TrainingSession, type SetLog, type LogSetInput, type ExercisePerformance, SessionStatus,
} from '@gigaflow/shared';

const TRAINING_SESSIONS = 'training_sessions';
const SET_LOGS = 'set_logs';
const EXERCISE_PERFORMANCE = 'exercise_performance';
const COUNTERS = 'counters';

interface CounterDoc {
  _id: string;
  seq: number;
}

function trainingSessions() { return getDb().collection(TRAINING_SESSIONS); }
function setLogs() { return getDb().collection(SET_LOGS); }
function exercisePerformance() { return getDb().collection(EXERCISE_PERFORMANCE); }
function counters() { return getDb().collection<CounterDoc>(COUNTERS); }

async function nextSessionNumber(userId: string): Promise<number> {
  const result = await counters().findOneAndUpdate(
    { _id: `session:${userId}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  if (!result) throw new Error(`Failed to increment session counter for user ${userId}`);
  return result.seq;
}

function mapId<T extends Record<string, unknown>>(doc: WithId<Document>): T {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as object) } as unknown as T;
}

export async function ensureTrainingIndexes(): Promise<void> {
  await trainingSessions().createIndex({ userId: 1, status: 1 });
  await trainingSessions().createIndex({ userId: 1, startedAt: -1 });
  await setLogs().createIndex({ sessionId: 1, setNumber: 1 });
  await exercisePerformance().createIndex({ userId: 1, exerciseId: 1 }, { unique: true });
}

export async function createSession(userId: string, templateId: string): Promise<TrainingSession> {
  const sessionNumber = await nextSessionNumber(userId);
  const doc = {
    userId,
    templateId,
    sessionNumber,
    startedAt: new Date(),
    status: SessionStatus.IN_PROGRESS,
  };
  const res = await trainingSessions().insertOne(doc);
  return { id: res.insertedId.toString(), ...doc };
}

export async function findSessionById(id: string): Promise<TrainingSession | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await trainingSessions().findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return mapId<TrainingSession>(doc);
}

export async function findActiveSession(userId: string): Promise<TrainingSession | null> {
  const doc = await trainingSessions().findOne({ userId, status: SessionStatus.IN_PROGRESS });
  if (!doc) return null;
  return mapId<TrainingSession>(doc);
}

/** The user's most recently completed session (highest sessionNumber), used to
 * suggest the next training day in rotation. */
export async function findLastCompletedSession(userId: string): Promise<TrainingSession | null> {
  const doc = await trainingSessions().findOne(
    { userId, status: SessionStatus.COMPLETED },
    { sort: { sessionNumber: -1 } },
  );
  if (!doc) return null;
  return mapId<TrainingSession>(doc);
}

export async function replaceSetLogs(sessionId: string, sets: LogSetInput[]): Promise<SetLog[]> {
  await setLogs().deleteMany({ sessionId });
  if (sets.length === 0) return [];
  const loggedAt = new Date();
  const docs = sets.map((s) => {
    const doc: Record<string, unknown> = {
      sessionId,
      slotId: s.slotId,
      exerciseId: s.exerciseId,
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      repsDone: s.repsDone,
      weightSuggested: s.weightSuggested,
      repsSuggested: s.repsSuggested,
      isCompleted: s.isCompleted,
      loggedAt,
    };
    if (s.restSeconds !== undefined) doc.restSeconds = s.restSeconds;
    if (s.rir !== undefined) doc.rir = s.rir;
    return doc;
  });
  const res = await setLogs().insertMany(docs);
  return docs.map((doc, idx) => {
    const insertedId = res.insertedIds[idx] as ObjectId;
    return { id: insertedId.toString(), ...doc };
  }) as unknown as SetLog[];
}

export async function listSetLogs(sessionId: string): Promise<SetLog[]> {
  const docs = await setLogs().find({ sessionId }).sort({ setNumber: 1 }).toArray();
  return docs.map((d) => mapId<SetLog>(d));
}

export async function updateSessionOnFinish(
  id: string,
  patch: { status: SessionStatus; finishedAt: Date; durationSeconds: number; totalVolume: number; totalSets: number },
): Promise<TrainingSession> {
  await trainingSessions().updateOne({ _id: new ObjectId(id) }, { $set: patch });
  const session = await findSessionById(id);
  if (!session) throw new Error(`TrainingSession ${id} not found after update`);
  return session;
}

export async function updateSessionStatus(id: string, status: SessionStatus): Promise<TrainingSession> {
  await trainingSessions().updateOne({ _id: new ObjectId(id) }, { $set: { status } });
  const session = await findSessionById(id);
  if (!session) throw new Error(`TrainingSession ${id} not found after update`);
  return session;
}

export async function findPerformanceMany(
  userId: string, exerciseIds: string[],
): Promise<Map<string, ExercisePerformance>> {
  const docs = await exercisePerformance().find({ userId, exerciseId: { $in: exerciseIds } }).toArray();
  const map = new Map<string, ExercisePerformance>();
  for (const doc of docs) {
    const perf = mapId<ExercisePerformance>(doc);
    map.set(perf.exerciseId, perf);
  }
  return map;
}

export async function findPerformance(userId: string, exerciseId: string): Promise<ExercisePerformance | null> {
  const doc = await exercisePerformance().findOne({ userId, exerciseId });
  if (!doc) return null;
  return mapId<ExercisePerformance>(doc);
}

export async function upsertPerformance(
  userId: string,
  exerciseId: string,
  data: {
    lastSets: ExercisePerformance['lastSets'];
    lastPerformedAt: Date;
    bestSet: ExercisePerformance['bestSet'];
    totalVolume: number;
    totalSessions: number;
  },
): Promise<void> {
  await exercisePerformance().updateOne(
    { userId, exerciseId },
    { $set: { userId, exerciseId, ...data } },
    { upsert: true },
  );
}
