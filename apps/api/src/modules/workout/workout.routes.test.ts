import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ensureExerciseIndexes } from '../exercise/exercise.repo.js';
import { seedPresets } from '../exercise/seed-exercises.js';
import { ensureWorkoutIndexes } from './workout.repo.js';
import { makeWorkoutRoutes } from './workout.routes.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';
import { ColorTag, EquipmentType, PlanTemplateType, type CreatePlanInput } from '@gigaflow/shared';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_wroutes_test');
  await ensureExerciseIndexes();
  await ensureWorkoutIndexes();
  await seedPresets();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) => (
  t === 'u1' || t === 'u2' ? { uid: t, signInProvider: 'anonymous' } : Promise.reject(new Error('bad'))
);
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };
const H2 = { Authorization: 'Bearer u2', 'Content-Type': 'application/json' };

function makeCreateInput(overrides: Partial<CreatePlanInput> = {}): CreatePlanInput {
  return {
    name: 'My PPL',
    templateType: PlanTemplateType.CUSTOM,
    templates: [
      {
        name: { en: 'Push', vi: 'Đẩy' },
        orderIndex: 0,
        colorTag: ColorTag.PUSH,
        slots: [
          {
            exerciseId: 'e1', orderIndex: 0, setsTarget: 3, repRangeMin: 6, repRangeMax: 10,
            equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('workout routes', () => {
  it('401 without token', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/active');
    expect(res.status).toBe(401);
  });
  it('GET /active returns null when no plan', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/active', { headers: { Authorization: 'Bearer u1' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.data).toBeNull();
  });
  it('POST /from-template creates a PPL plan (201) then GET /active returns it nested', async () => {
    const app = makeWorkoutRoutes({ verify });
    const create = await app.request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'ppl' }) });
    expect(create.status).toBe(201);
    const active = await app.request('/active', { headers: { Authorization: 'Bearer u1' } });
    const body = (await active.json()) as { data: { templateType: string; templates: Array<{ slots: unknown[] }> } };
    expect(body.data.templateType).toBe('ppl');
    expect(body.data.templates.length).toBe(6);
    expect(body.data.templates[0].slots.length).toBeGreaterThan(0);
  });
  it('POST /from-template with custom → 400', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'custom' }) });
    expect(res.status).toBe(400);
  });
  it('POST /from-template with invalid type → 400', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'bro' }) });
    expect(res.status).toBe(400);
  });

  describe('plan CRUD', () => {
    it('POST /plans creates a plan (200) with server ids + source custom; then GET /plans lists it', async () => {
      const app = makeWorkoutRoutes({ verify });
      const create = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(makeCreateInput({ name: 'Create List Plan' })) });
      expect(create.status).toBe(200);
      const createBody = (await create.json()) as { data: { id: string; source: string; templates: Array<{ id: string; slots: Array<{ id: string }> }> } };
      expect(createBody.data.source).toBe('custom');
      expect(createBody.data.id).toBeTruthy();
      expect(createBody.data.templates[0]?.id).toBeTruthy();
      expect(createBody.data.templates[0]?.slots[0]?.id).toBeTruthy();

      const list = await app.request('/', { headers: { Authorization: 'Bearer u1' } });
      expect(list.status).toBe(200);
      const listBody = (await list.json()) as { data: Array<{ id: string; name: string }> };
      expect(listBody.data.some((p) => p.id === createBody.data.id && p.name === 'Create List Plan')).toBe(true);
    });

    it('GET /plans/:id returns the graph for the owner; 404 for another user', async () => {
      const app = makeWorkoutRoutes({ verify });
      const create = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(makeCreateInput({ name: 'Owner Plan' })) });
      const { data: created } = (await create.json()) as { data: { id: string } };

      const own = await app.request(`/${created.id}`, { headers: { Authorization: 'Bearer u1' } });
      expect(own.status).toBe(200);
      const ownBody = (await own.json()) as { data: { id: string } };
      expect(ownBody.data.id).toBe(created.id);

      const other = await app.request(`/${created.id}`, { headers: { Authorization: 'Bearer u2' } });
      expect(other.status).toBe(404);
    });

    it('PUT /plans/:id replaces the graph; 404 for non-owner', async () => {
      const app = makeWorkoutRoutes({ verify });
      const create = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(makeCreateInput({ name: 'Update Plan' })) });
      const { data: created } = (await create.json()) as { data: { id: string } };

      const updateInput = makeCreateInput({
        name: 'Update Plan v2',
        templates: [
          {
            name: { en: 'Pull', vi: 'Kéo' },
            orderIndex: 0,
            colorTag: ColorTag.PULL,
            slots: [
              { exerciseId: 'e2', orderIndex: 0, setsTarget: 4, repRangeMin: 8, repRangeMax: 12, equipmentType: EquipmentType.DUMBBELL, weightIncrement: 1 },
              { exerciseId: 'e3', orderIndex: 1, setsTarget: 3, repRangeMin: 6, repRangeMax: 8, equipmentType: EquipmentType.CABLE, weightIncrement: 2.5 },
            ],
          },
        ],
      });
      const update = await app.request(`/${created.id}`, { method: 'PUT', headers: H, body: JSON.stringify(updateInput) });
      expect(update.status).toBe(200);
      const updateBody = (await update.json()) as { data: { name: string; templates: Array<{ slots: Array<{ exerciseId: string }> }> } };
      expect(updateBody.data.name).toBe('Update Plan v2');
      expect(updateBody.data.templates[0]?.slots.length).toBe(2);
      expect(updateBody.data.templates[0]?.slots[0]?.exerciseId).toBe('e2');

      const notOwner = await app.request(`/${created.id}`, { method: 'PUT', headers: H2, body: JSON.stringify(updateInput) });
      expect(notOwner.status).toBe(404);
    });

    it('POST /plans/:id/activate sets isActive true; GET /active returns it; activating a second flips the first off', async () => {
      const app = makeWorkoutRoutes({ verify });
      const create1 = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(makeCreateInput({ name: 'Activate Plan 1' })) });
      const { data: p1 } = (await create1.json()) as { data: { id: string } };
      const create2 = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(makeCreateInput({ name: 'Activate Plan 2' })) });
      const { data: p2 } = (await create2.json()) as { data: { id: string } };

      const activate1 = await app.request(`/${p1.id}/activate`, { method: 'POST', headers: H });
      expect(activate1.status).toBe(200);
      const activate1Body = (await activate1.json()) as { data: { isActive: boolean } };
      expect(activate1Body.data.isActive).toBe(true);

      const active1 = await app.request('/active', { headers: { Authorization: 'Bearer u1' } });
      const active1Body = (await active1.json()) as { data: { id: string } | null };
      expect(active1Body.data?.id).toBe(p1.id);

      const activate2 = await app.request(`/${p2.id}/activate`, { method: 'POST', headers: H });
      expect(activate2.status).toBe(200);

      const check1 = await app.request(`/${p1.id}`, { headers: { Authorization: 'Bearer u1' } });
      const check1Body = (await check1.json()) as { data: { isActive: boolean } };
      expect(check1Body.data.isActive).toBe(false);

      const active2 = await app.request('/active', { headers: { Authorization: 'Bearer u1' } });
      const active2Body = (await active2.json()) as { data: { id: string } | null };
      expect(active2Body.data?.id).toBe(p2.id);
    });

    it('POST /plans/:id/activate by a non-owner → 404 and leaves the target plan unchanged', async () => {
      const app = makeWorkoutRoutes({ verify });
      const create = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(makeCreateInput({ name: 'Activate NonOwner Plan' })) });
      const { data: created } = (await create.json()) as { data: { id: string; isActive: boolean } };
      expect(created.isActive).toBe(false);

      const activateByOther = await app.request(`/${created.id}/activate`, { method: 'POST', headers: H2 });
      expect(activateByOther.status).toBe(404);

      const check = await app.request(`/${created.id}`, { headers: { Authorization: 'Bearer u1' } });
      expect(check.status).toBe(200);
      const checkBody = (await check.json()) as { data: { isActive: boolean } };
      expect(checkBody.data.isActive).toBe(false);
    });

    it('DELETE /plans/:id → {deleted:true}, then GET /plans/:id → 404; deleting again → 404', async () => {
      const app = makeWorkoutRoutes({ verify });
      const create = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(makeCreateInput({ name: 'Delete Plan' })) });
      const { data: created } = (await create.json()) as { data: { id: string } };

      const del = await app.request(`/${created.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer u1' } });
      expect(del.status).toBe(200);
      const delBody = (await del.json()) as { data: { deleted: boolean } };
      expect(delBody.data.deleted).toBe(true);

      const getAfter = await app.request(`/${created.id}`, { headers: { Authorization: 'Bearer u1' } });
      expect(getAfter.status).toBe(404);

      const delAgain = await app.request(`/${created.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer u1' } });
      expect(delAgain.status).toBe(404);
    });

    it('DELETE /plans/:id by a non-owner → 404 and leaves the plan intact', async () => {
      const app = makeWorkoutRoutes({ verify });
      const create = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(makeCreateInput({ name: 'Delete NonOwner Plan' })) });
      const { data: created } = (await create.json()) as { data: { id: string } };

      const delByOther = await app.request(`/${created.id}`, { method: 'DELETE', headers: H2 });
      expect(delByOther.status).toBe(404);

      const stillThere = await app.request(`/${created.id}`, { headers: { Authorization: 'Bearer u1' } });
      expect(stillThere.status).toBe(200);
    });

    it('POST /plans with repRangeMax < repRangeMin → 400', async () => {
      const app = makeWorkoutRoutes({ verify });
      const badInput = makeCreateInput({
        templates: [
          {
            name: { en: 'Push', vi: 'Đẩy' },
            orderIndex: 0,
            colorTag: ColorTag.PUSH,
            slots: [
              { exerciseId: 'e1', orderIndex: 0, setsTarget: 3, repRangeMin: 10, repRangeMax: 6, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5 },
            ],
          },
        ],
      });
      const res = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify(badInput) });
      expect(res.status).toBe(400);
    });
  });
});
