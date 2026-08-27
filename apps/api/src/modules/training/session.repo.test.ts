import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType } from '@gigaflow/shared';
import { ensureWorkoutIndexes, insertPlanGraph, getTemplateWithSlotsForUser } from '../workout/workout.repo.js';
import {
  ensureTrainingIndexes, createSession, replaceSetLogs, listSetLogs,
  upsertPerformance, findPerformanceMany, findActiveSession,
} from './session.repo.js';

let mongod: MongoMemoryServer;
let templateId: string;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_sess_test');
  await ensureWorkoutIndexes();
  await ensureTrainingIndexes();
  const plan = await insertPlanGraph('u1', { name: 'P', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: true }, [
    { name: { en: 'Push', vi: 'Đẩy' }, orderIndex: 0, colorTag: ColorTag.PUSH, slots: [{ exerciseId: 'e1', orderIndex: 0, setsTarget: 3, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5 }] },
  ]);
  templateId = plan.templates[0].id;
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('SessionRepository', () => {
  it('createSession assigns incrementing sessionNumber and active status', async () => {
    const s1 = await createSession('u1', templateId);
    const s2 = await createSession('u1', templateId);
    expect(s1.sessionNumber).toBe(1);
    expect(s2.sessionNumber).toBe(2);
    expect((await findActiveSession('u1'))).not.toBeNull();
  });
  it('createSession assigns distinct sessionNumbers under concurrent calls', async () => {
    const [s1, s2] = await Promise.all([
      createSession('u-concurrent', templateId),
      createSession('u-concurrent', templateId),
    ]);
    expect(new Set([s1.sessionNumber, s2.sessionNumber])).toEqual(new Set([1, 2]));
  });
  it('replaceSetLogs then listSetLogs round-trips sorted', async () => {
    const s = await createSession('u1', templateId);
    await replaceSetLogs(s.id, [
      { slotId: 'sl1', exerciseId: 'e1', setNumber: 2, weightKg: 80, repsDone: 8, weightSuggested: 80, repsSuggested: 8, isCompleted: true },
      { slotId: 'sl1', exerciseId: 'e1', setNumber: 1, weightKg: 80, repsDone: 8, weightSuggested: 80, repsSuggested: 8, isCompleted: true },
    ]);
    const logs = await listSetLogs(s.id);
    expect(logs.map((l) => l.setNumber)).toEqual([1, 2]);
  });
  it('upsertPerformance then findPerformanceMany returns it', async () => {
    await upsertPerformance('u1', 'e1', { lastSets: [{ weightKg: 80, repsDone: 8 }], lastPerformedAt: new Date(), bestSet: { weightKg: 80, repsDone: 8, e1RM: 101.3 }, totalVolume: 640, totalSessions: 1 });
    const map = await findPerformanceMany('u1', ['e1', 'e2']);
    expect(map.get('e1')?.bestSet.e1RM).toBe(101.3);
    expect(map.has('e2')).toBe(false);
  });
  it('getTemplateWithSlotsForUser returns slots for owner, null for others', async () => {
    const owned = await getTemplateWithSlotsForUser('u1', templateId);
    expect(owned?.slots).toHaveLength(1);
    expect(await getTemplateWithSlotsForUser('u2', templateId)).toBeNull();
  });
});
