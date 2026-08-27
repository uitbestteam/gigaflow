import type { Document, WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import { DevicePlatform, type DeviceToken } from '@gigaflow/shared';

const COLLECTION = 'device_tokens';

function collection() {
  return getDb().collection(COLLECTION);
}

function mapId(doc: WithId<Document>): DeviceToken {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as object) } as unknown as DeviceToken;
}

export async function ensureDeviceTokenIndexes(): Promise<void> {
  await collection().createIndex({ token: 1 }, { unique: true });
  await collection().createIndex({ userId: 1 });
}

export async function upsertDeviceToken(
  userId: string,
  token: string,
  platform?: DevicePlatform,
): Promise<DeviceToken> {
  const now = new Date();
  const res = await collection().findOneAndUpdate(
    { token },
    {
      $set: {
        userId,
        updatedAt: now,
        ...(platform !== undefined && platform !== null ? { platform } : {}),
      },
      $setOnInsert: { token, createdAt: now },
      ...(platform === undefined || platform === null ? { $unset: { platform: '' } } : {}),
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!res) throw new Error('Failed to upsert device token');
  return mapId(res);
}

export async function deleteDeviceToken(userId: string, token: string): Promise<boolean> {
  const res = await collection().deleteOne({ token, userId });
  return res.deletedCount > 0;
}

export async function listTokens(userId: string): Promise<DeviceToken[]> {
  const docs = await collection().find({ userId }).toArray();
  return docs.map(mapId);
}

export async function deleteTokens(tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;
  const res = await collection().deleteMany({ token: { $in: tokens } });
  return res.deletedCount;
}
