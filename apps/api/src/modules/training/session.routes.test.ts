import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType, type LogSetInput } from '@gigaflow/shared';
import { ensureWorkoutIndexes, insertPlanGraph } from '../workout/workout.repo.js';
import { ensureTrainingIndexes } from './session.repo.js';
import { makeSessionRoutes, makeLastPerfRoutes } from './session.routes.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';

let mongod: MongoMemoryServer;
let templateId: string;
let exerciseId: string;
let slotId: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_session_routes_test');
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
  const slot = template.slots[0];
  if (!slot) throw new Error('seed slot missing');
  exerciseId = slot.exerciseId;
  slotId = slot.id;
});

afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

const verify: TokenVerifier = async (t) => (t === 'u1' ? { uid: 'u1', signInProvider: 'anonymous' } : Promise.reject(new Error('bad')));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

describe('session routes', () => {
  it('401 without token', async () => {
    const res = await makeSessionRoutes({ verify }).request('/active');
    expect(res.status).toBe(401);
  });

  it('GET /exercises/:id/last returns null before any session', async () => {
    const res = await makeLastPerfRoutes({ verify }).request(`/${exerciseId}/last`, { headers: { Authorization: 'Bearer u1' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toBeNull();
  });

  it('POST /start → 201 with fresh weightSuggested 0; GET /active returns it; log sets, finish 200, then sets on finished → 409', async () => {
    const app = makeSessionRoutes({ verify });

    const start = await app.request('/start', { method: 'POST', headers: H, body: JSON.stringify({ templateId }) });
    expect(start.status).toBe(201);
    const startBody = (await start.json()) as { data: { session: { id: string; status: string }; slots: Array<{ weightSuggested: number }> } };
    expect(startBody.data.session.status).toBe('in_progress');
    const slot = startBody.data.slots[0];
    if (!slot) throw new Error('expected a slot');
    expect(slot.weightSuggested).toBe(0);
    const sessionId = startBody.data.session.id;

    const active = await app.request('/active', { headers: { Authorization: 'Bearer u1' } });
    expect(active.status).toBe(200);
    const activeBody = (await active.json()) as { data: { id: string } | null };
    expect(activeBody.data?.id).toBe(sessionId);

    const sets: LogSetInput[] = [
      {
        slotId, exerciseId, setNumber: 1, weightKg: 40, repsDone: 8,
        weightSuggested: 0, repsSuggested: 6, isCompleted: true,
      },
    ];
    const logRes = await app.request(`/${sessionId}/sets`, { method: 'POST', headers: H, body: JSON.stringify({ sets }) });
    expect(logRes.status).toBe(200);

    const finish = await app.request(`/${sessionId}/finish`, { method: 'POST', headers: H });
    expect(finish.status).toBe(200);
    const finishBody = (await finish.json()) as { data: { status: string } };
    expect(finishBody.data.status).toBe('completed');

    const setsAfterFinish = await app.request(`/${sessionId}/sets`, { method: 'POST', headers: H, body: JSON.stringify({ sets }) });
    expect(setsAfterFinish.status).toBe(409);

    const lastPerf = await makeLastPerfRoutes({ verify }).request(`/${exerciseId}/last`, { headers: { Authorization: 'Bearer u1' } });
    expect(lastPerf.status).toBe(200);
    const lastPerfBody = (await lastPerf.json()) as { data: { exerciseId: string } | null };
    expect(lastPerfBody.data?.exerciseId).toBe(exerciseId);
  });

  it('POST /start with bad body → 400', async () => {
    const res = await makeSessionRoutes({ verify }).request('/start', { method: 'POST', headers: H, body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });

  it('POST /:id/cancel cancels an in-progress session', async () => {
    const app = makeSessionRoutes({ verify });
    const start = await app.request('/start', { method: 'POST', headers: H, body: JSON.stringify({ templateId }) });
    const startBody = (await start.json()) as { data: { session: { id: string } } };
    const sessionId = startBody.data.session.id;

    const cancel = await app.request(`/${sessionId}/cancel`, { method: 'POST', headers: H });
    expect(cancel.status).toBe(200);
    const cancelBody = (await cancel.json()) as { data: { status: string } };
    expect(cancelBody.data.status).toBe('cancelled');
  });
});
