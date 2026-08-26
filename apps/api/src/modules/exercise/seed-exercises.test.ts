import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ensureExerciseIndexes, listVisible } from './exercise.repo.js';
import { PRESET_EXERCISES, seedPresets } from './seed-exercises.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_seed_test');
  await ensureExerciseIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('seedPresets', () => {
  it('has at least 50 presets with unique slugs and en/vi names', () => {
    expect(PRESET_EXERCISES.length).toBeGreaterThanOrEqual(50);
    const slugs = new Set(PRESET_EXERCISES.map((p) => p.slug));
    expect(slugs.size).toBe(PRESET_EXERCISES.length);
    for (const p of PRESET_EXERCISES) {
      expect(p.name.en.length).toBeGreaterThan(0);
      expect(p.name.vi.length).toBeGreaterThan(0);
    }
  });
  it('is idempotent — seeding twice yields one row per slug', async () => {
    await seedPresets();
    await seedPresets();
    const all = await listVisible('anyone', {});
    expect(all.length).toBe(PRESET_EXERCISES.length);
  });
});
