import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType } from '@gigaflow/shared';
import { ensureWorkoutIndexes, insertPlanGraph } from '../workout/workout.repo.js';
import { ensureTrainingIndexes } from './session.repo.js';
import {
  SessionError, startSession, logSets, finishSession, cancelSession, lastForExercise,
} from './session.service.js';

let mongod: MongoMemoryServer;
let templateId: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_session_service_test');
  await ensureWorkoutIndexes();
  await ensureTrainingIndexes();
  const plan = await insertPlanGraph(
    'u1',
    { name: 'P', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: true },
    [
      {
        name: { en: 'Push', vi: 'Đẩy' },
        orderIndex: 0,
        colorTag: ColorTag.PUSH,
        slots: [
          {
            exerciseId: 'e1', orderIndex: 0, setsTarget: 2, repRangeMin: 6, repRangeMax: 10,
            equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5,
          },
        ],
      },
    ],
  );
  const template = plan.templates[0];
  if (!template) throw new Error('seed template missing');
  templateId = template.id;
});

afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

describe('session.service', () => {
  it('startSession for a fresh user returns targets with reason first and weight 0', async () => {
    const result = await startSession('u1', templateId);
    expect(result.session.status).toBe('in_progress');
    expect(result.slots).toHaveLength(1);
    const slot = result.slots[0];
    if (!slot) throw new Error('expected a slot');
    expect(slot.reason).toBeUndefined();
    expect(slot.weightSuggested).toBe(0);
    expect(slot.repsSuggested).toBe(6);
    expect(slot.lastSets).toBeUndefined();
  });

  it('end-to-end: logging all-max sets then finishing suggests increased weight on second start', async () => {
    const first = await startSession('u1', templateId);
    const slot = first.slots[0];
    if (!slot) throw new Error('expected a slot');

    await logSets('u1', first.session.id, [
      {
        slotId: slot.id, exerciseId: slot.exerciseId, setNumber: 1, weightKg: 80, repsDone: 10,
        weightSuggested: slot.weightSuggested, repsSuggested: slot.repsSuggested, isCompleted: true,
      },
      {
        slotId: slot.id, exerciseId: slot.exerciseId, setNumber: 2, weightKg: 80, repsDone: 10,
        weightSuggested: slot.weightSuggested, repsSuggested: slot.repsSuggested, isCompleted: true,
      },
    ]);

    const finished = await finishSession('u1', first.session.id);
    expect(finished.status).toBe('completed');
    expect(finished.totalSets).toBe(2);
    expect(finished.totalVolume).toBe(80 * 10 * 2);

    const second = await startSession('u1', templateId);
    const secondSlot = second.slots[0];
    if (!secondSlot) throw new Error('expected a slot');
    expect(secondSlot.weightSuggested).toBe(82.5);
    expect(secondSlot.repsSuggested).toBe(6);
  });

  it('logging into a finished session throws 409', async () => {
    const started = await startSession('u1', templateId);
    const slot = started.slots[0];
    if (!slot) throw new Error('expected a slot');
    await finishSession('u1', started.session.id);

    await expect(
      logSets('u1', started.session.id, [
        {
          slotId: slot.id, exerciseId: slot.exerciseId, setNumber: 1, weightKg: 80, repsDone: 8,
          weightSuggested: slot.weightSuggested, repsSuggested: slot.repsSuggested, isCompleted: true,
        },
      ]),
    ).rejects.toMatchObject(new SessionError('Session not in progress', 409));
  });

  it('starting a session for an unowned template throws 404', async () => {
    await expect(startSession('someone-else', templateId)).rejects.toMatchObject(
      new SessionError('Template not found', 404),
    );
  });

  it('cancelSession sets status to cancelled', async () => {
    const started = await startSession('u1', templateId);
    const cancelled = await cancelSession('u1', started.session.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('lastForExercise returns null when no performance recorded for that exercise', async () => {
    expect(await lastForExercise('u1', 'e-unseen')).toBeNull();
  });

  it('lastForExercise returns performance after a finished session', async () => {
    const perfBefore = await lastForExercise('u1', 'e1');
    const started = await startSession('u1', templateId);
    const slot = started.slots[0];
    if (!slot) throw new Error('expected a slot');
    await logSets('u1', started.session.id, [
      {
        slotId: slot.id, exerciseId: slot.exerciseId, setNumber: 1, weightKg: 60, repsDone: 8,
        weightSuggested: slot.weightSuggested, repsSuggested: slot.repsSuggested, isCompleted: true,
      },
    ]);
    await finishSession('u1', started.session.id);
    const perf = await lastForExercise('u1', 'e1');
    expect(perf?.totalSessions).toBe((perfBefore?.totalSessions ?? 0) + 1);
  });
});
