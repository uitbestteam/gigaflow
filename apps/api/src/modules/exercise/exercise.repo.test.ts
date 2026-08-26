import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { MuscleGroup, EquipmentType } from '@gigaflow/shared';
import {
  ensureExerciseIndexes, upsertPreset, createCustom, listVisible, findById, ExerciseConflictError,
} from './exercise.repo.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_ex_test');
  await ensureExerciseIndexes();
  await upsertPreset({ slug: 'bench-barbell', name: { en: 'Bench press', vi: 'Đẩy ngực' }, muscleGroup: MuscleGroup.CHEST, equipmentType: EquipmentType.BARBELL, defaultIncrement: 2.5 });
  await upsertPreset({ slug: 'squat-barbell', name: { en: 'Barbell squat', vi: 'Squat' }, muscleGroup: MuscleGroup.LEGS, equipmentType: EquipmentType.BARBELL, defaultIncrement: 2.5 });
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('ExerciseRepository', () => {
  it('upsertPreset is idempotent (no duplicate presets)', async () => {
    await upsertPreset({ slug: 'bench-barbell', name: { en: 'Bench press', vi: 'Đẩy ngực' }, muscleGroup: MuscleGroup.CHEST, equipmentType: EquipmentType.BARBELL, defaultIncrement: 2.5 });
    const all = await listVisible('u1', {});
    expect(all.filter((e) => e.slug === 'bench-barbell')).toHaveLength(1);
  });
  it('creates a custom exercise owned by the user, with an id', async () => {
    const ex = await createCustom('u1', { name: { en: 'My Special Curl', vi: 'Cuốn đặc biệt' }, muscleGroup: MuscleGroup.ARMS, equipmentType: EquipmentType.DUMBBELL });
    expect(ex.id).toMatch(/^[a-f0-9]{24}$/);
    expect(ex.isCustom).toBe(true);
    expect(ex.ownerUserId).toBe('u1');
    expect(ex.slug).toBe('my-special-curl');
    expect(ex.defaultIncrement).toBe(2.5);
    const round = await findById(ex.id);
    expect(round?.slug).toBe('my-special-curl');
  });
  it('custom exercise is visible to owner but not to others', async () => {
    const mine = await listVisible('u1', {});
    const theirs = await listVisible('u2', {});
    expect(mine.some((e) => e.slug === 'my-special-curl')).toBe(true);
    expect(theirs.some((e) => e.slug === 'my-special-curl')).toBe(false);
    // both see presets
    expect(theirs.some((e) => e.slug === 'bench-barbell')).toBe(true);
  });
  it('filters by muscle group and search query', async () => {
    const legs = await listVisible('u1', { muscleGroup: MuscleGroup.LEGS });
    expect(legs.every((e) => e.muscleGroup === MuscleGroup.LEGS)).toBe(true);
    const q = await listVisible('u1', { q: 'bench' });
    expect(q.some((e) => e.slug === 'bench-barbell')).toBe(true);
  });
  it('rejects a duplicate custom slug for the same owner with ExerciseConflictError', async () => {
    await expect(
      createCustom('u1', { name: { en: 'My Special Curl', vi: 'x' }, muscleGroup: MuscleGroup.ARMS, equipmentType: EquipmentType.DUMBBELL }),
    ).rejects.toBeInstanceOf(ExerciseConflictError);
  });
  it('omits ownerUserId for presets but keeps it for custom exercises', async () => {
    const all = await listVisible('u1', {});
    const preset = all.find((e) => e.slug === 'bench-barbell');
    expect(preset).toBeDefined();
    expect(preset?.ownerUserId).toBeUndefined();
    expect(preset && 'ownerUserId' in preset).toBe(false);

    const presetById = await findById(preset!.id);
    expect(presetById?.ownerUserId).toBeUndefined();
    expect(presetById && 'ownerUserId' in presetById).toBe(false);

    const custom = all.find((e) => e.slug === 'my-special-curl');
    expect(custom?.ownerUserId).toBe('u1');
  });
});
