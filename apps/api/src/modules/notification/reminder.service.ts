import { getDb } from '../../lib/db.js';
import { Language, SessionStatus } from '@gigaflow/shared';
import { listTokens, deleteTokens } from './device-token.repo.js';
import { findByAuthId } from '../auth/user.repo.js';
import type { PushSender, PushMessage } from './push-sender.js';

const DEVICE_TOKENS = 'device_tokens';
const TRAINING_SESSIONS = 'training_sessions';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REMINDER_BATCH_SIZE = 20;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const REMINDER_MESSAGES: Record<Language, PushMessage> = {
  [Language.EN]: {
    title: 'Time to train!',
    body: "You haven't logged a workout in a few days. Let's get back to it!",
  },
  [Language.VI]: {
    title: 'Đến giờ tập luyện rồi!',
    body: 'Bạn chưa tập luyện trong vài ngày rồi. Cùng quay lại tập nhé!',
  },
};

interface LatestSessionProjection {
  userId: string;
  status: SessionStatus;
  startedAt: Date;
  finishedAt?: Date;
}

async function latestCompletedSession(userId: string): Promise<LatestSessionProjection | null> {
  const doc = await getDb()
    .collection<LatestSessionProjection>(TRAINING_SESSIONS)
    .find({ userId, status: SessionStatus.COMPLETED })
    .sort({ startedAt: -1 })
    .limit(1)
    .next();
  return doc;
}

export async function findUsersDueForWorkoutReminder(now: Date, thresholdDays = 3): Promise<string[]> {
  const cutoff = new Date(now.getTime() - thresholdDays * MS_PER_DAY);
  const userIds = await getDb().collection<{ userId: string }>(DEVICE_TOKENS).distinct('userId');
  if (userIds.length === 0) return [];

  const dueFlags = await Promise.all(
    userIds.map(async (userId): Promise<string | null> => {
      const session = await latestCompletedSession(userId);
      if (!session) return null;
      const referenceDate = session.finishedAt ?? session.startedAt;
      return referenceDate < cutoff ? userId : null;
    }),
  );

  return dueFlags.filter((userId): userId is string => userId !== null);
}

export async function sendWorkoutReminders(
  now: Date,
  deps: { sender: PushSender },
): Promise<{ notified: number }> {
  const userIds = await findUsersDueForWorkoutReminder(now);

  for (const batch of chunk(userIds, REMINDER_BATCH_SIZE)) {
    await Promise.all(
      batch.map(async (userId) => {
        try {
          const tokens = await listTokens(userId);
          if (tokens.length === 0) return;
          const user = await findByAuthId(userId);
          const lang = user?.language ?? Language.EN;
          const message = REMINDER_MESSAGES[lang];
          const { invalidTokens } = await deps.sender.send(tokens.map((t) => t.token), message);
          if (invalidTokens.length > 0) {
            await deleteTokens(invalidTokens);
          }
        } catch (err) {
          console.error('reminder.service: failed to send workout reminder', { userId, err });
        }
      }),
    );
  }

  return { notified: userIds.length };
}
