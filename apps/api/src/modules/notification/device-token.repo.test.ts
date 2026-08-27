import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { DevicePlatform } from '@gigaflow/shared';
import {
  ensureDeviceTokenIndexes, upsertDeviceToken, deleteDeviceToken, listTokens,
} from './device-token.repo.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_device_token_test');
  await ensureDeviceTokenIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('device-token.repo', () => {
  it('upserts a device token for a user', async () => {
    const result = await upsertDeviceToken('u1', 'tok-1', DevicePlatform.IOS);
    expect(result.id).toMatch(/^[a-f0-9]{24}$/);
    expect(result.userId).toBe('u1');
    expect(result.token).toBe('tok-1');
    expect(result.platform).toBe(DevicePlatform.IOS);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('omits platform when not provided', async () => {
    const result = await upsertDeviceToken('u1', 'tok-no-platform');
    expect(result).not.toHaveProperty('platform');
  });

  it('re-registering a token under another user reassigns ownership', async () => {
    const first = await upsertDeviceToken('u1', 'tok-shared', DevicePlatform.ANDROID);
    const second = await upsertDeviceToken('u2', 'tok-shared', DevicePlatform.WEB);

    expect(second.id).toBe(first.id);
    expect(second.userId).toBe('u2');
    expect(second.platform).toBe(DevicePlatform.WEB);

    const tokensForU1 = await listTokens('u1');
    expect(tokensForU1.find((t) => t.token === 'tok-shared')).toBeUndefined();

    const tokensForU2 = await listTokens('u2');
    expect(tokensForU2.find((t) => t.token === 'tok-shared')).toBeDefined();
  });

  it('updates an existing token in place (createdAt stable, updatedAt bumped)', async () => {
    const first = await upsertDeviceToken('u3', 'tok-update', DevicePlatform.IOS);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await upsertDeviceToken('u3', 'tok-update', DevicePlatform.ANDROID);

    expect(second.id).toBe(first.id);
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
    expect(second.platform).toBe(DevicePlatform.ANDROID);
  });

  it('deleteDeviceToken only deletes a token owned by the caller', async () => {
    await upsertDeviceToken('owner', 'tok-owned', DevicePlatform.IOS);

    expect(await deleteDeviceToken('someone-else', 'tok-owned')).toBe(false);
    const stillThere = await listTokens('owner');
    expect(stillThere.find((t) => t.token === 'tok-owned')).toBeDefined();

    expect(await deleteDeviceToken('owner', 'tok-owned')).toBe(true);
    const afterDelete = await listTokens('owner');
    expect(afterDelete.find((t) => t.token === 'tok-owned')).toBeUndefined();
  });

  it('deleteDeviceToken returns false for a non-existent token', async () => {
    expect(await deleteDeviceToken('owner', 'no-such-token')).toBe(false);
  });

  it('listTokens returns all tokens for a user', async () => {
    await upsertDeviceToken('u4', 'tok-a', DevicePlatform.IOS);
    await upsertDeviceToken('u4', 'tok-b', DevicePlatform.ANDROID);

    const tokens = await listTokens('u4');
    expect(tokens).toHaveLength(2);
    expect(tokens.map((t) => t.token).sort()).toEqual(['tok-a', 'tok-b']);
  });
});
