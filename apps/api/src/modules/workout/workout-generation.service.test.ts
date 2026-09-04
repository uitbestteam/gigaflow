import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import {
  ColorTag, EquipmentType, ExperienceLevel, Goal, GenerationType, JobStatus, type GeneratedPlan,
} from '@gigaflow/shared';
import { ensureExerciseIndexes } from '../exercise/exercise.repo.js';
import { seedPresets } from '../exercise/seed-exercises.js';
import { ensureWorkoutIndexes, findActivePlan } from './workout.repo.js';
import { ensureGenerationJobIndexes, createJob, findJobForUser } from './generation-job.repo.js';
import { incrementUsage, checkQuota } from '../subscription/quota.service.js';
import { processGenerateWorkout, type WorkoutGenDeps } from './workout-generation.service.js';

let mongod: MongoMemoryServer;
const NOW = new Date('2026-08-26T00:00:00Z');

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_wogen_test');
  await ensureExerciseIndexes();
  await ensureWorkoutIndexes();
  await ensureGenerationJobIndexes();
  await seedPresets();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });
beforeEach(async () => { await getDb().collection('users').deleteMany({}); });

async function makeUser(authId: string) {
  await getDb().collection('users').insertOne({
    authId, authSource: 'firebase', authProvider: 'anonymous', isGuest: true,
    timezone: 'Asia/Ho_Chi_Minh', language: 'en', createdAt: NOW, updatedAt: NOW,
  });
}

const validPlan: GeneratedPlan = {
  name: 'AI Push Pull Legs',
  templates: [
    {
      name: { en: 'Push Day', vi: 'Ngày đẩy' },
      colorTag: ColorTag.PUSH,
      slots: [
        { exerciseSlug: 'bench-barbell', setsTarget: 4, repRangeMin: 6, repRangeMax: 10 },
        { exerciseSlug: 'ohp-barbell', setsTarget: 3, repRangeMin: 8, repRangeMax: 12 },
      ],
    },
  ],
};

describe('workout-generation.service', () => {
  it('processes a job end-to-end: job done + resultId + active plan created', async () => {
    await makeUser('gen-u1');
    await incrementUsage('gen-u1', GenerationType.WORKOUT, NOW);

    const job = await createJob('gen-u1', GenerationType.WORKOUT, {
      goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 3,
    });

    const deps: WorkoutGenDeps = { engine: { generateWorkoutPlan: async () => validPlan } };
    await processGenerateWorkout(job.id, deps);

    const found = await findJobForUser('gen-u1', job.id);
    expect(found?.status).toBe(JobStatus.DONE);
    expect(found?.resultId).toMatch(/^[a-f0-9]{24}$/);

    const activePlan = await findActivePlan('gen-u1');
    expect(activePlan).not.toBeNull();
    expect(activePlan?.source).toBe('ai');
    expect(activePlan?.templates).toHaveLength(1);
    expect(activePlan?.templates[0].slots).toHaveLength(2);
  });

  it('marks the job failed and rolls back quota when the engine throws', async () => {
    await makeUser('gen-u2');
    await incrementUsage('gen-u2', GenerationType.WORKOUT, NOW);
    const before = await checkQuota('gen-u2', GenerationType.WORKOUT, NOW);
    expect(before.used).toBe(1);

    const job = await createJob('gen-u2', GenerationType.WORKOUT, {
      goal: Goal.HYPERTROPHY, experienceLevel: ExperienceLevel.INTERMEDIATE, daysPerWeek: 4,
    });

    const deps: WorkoutGenDeps = {
      engine: { generateWorkoutPlan: async () => { throw new Error('provider unavailable'); } },
    };
    await expect(processGenerateWorkout(job.id, deps)).rejects.toThrow('provider unavailable');

    const found = await findJobForUser('gen-u2', job.id);
    expect(found?.status).toBe(JobStatus.FAILED);
    expect(found?.error).toBe('provider unavailable');

    const after = await checkQuota('gen-u2', GenerationType.WORKOUT, NOW);
    expect(after.used).toBe(0);
  });

  it('throws when the AI plan has no resolvable exercises', async () => {
    await makeUser('gen-u3');
    const job = await createJob('gen-u3', GenerationType.WORKOUT, {
      goal: Goal.GENERAL_FITNESS, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 2,
    });
    const badPlan: GeneratedPlan = {
      name: 'Bad plan',
      templates: [
        { name: { en: 'Day', vi: 'Ngày' }, colorTag: ColorTag.FULL, slots: [{ exerciseSlug: 'not-a-real-slug', setsTarget: 3, repRangeMin: 8, repRangeMax: 12 }] },
      ],
    };
    const deps: WorkoutGenDeps = { engine: { generateWorkoutPlan: async () => badPlan } };
    await expect(processGenerateWorkout(job.id, deps)).rejects.toThrow('AI plan had no resolvable exercises');

    const found = await findJobForUser('gen-u3', job.id);
    expect(found?.status).toBe(JobStatus.FAILED);
  });

  it('throws when the job does not exist', async () => {
    const deps: WorkoutGenDeps = { engine: { generateWorkoutPlan: async () => validPlan } };
    await expect(processGenerateWorkout('000000000000000000000000', deps)).rejects.toThrow();
  });

  it('filters the catalog to the available equipment and passes intake directives', async () => {
    await makeUser('gen-eq1');
    const job = await createJob('gen-eq1', GenerationType.WORKOUT, {
      goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.INTERMEDIATE, daysPerWeek: 3,
      availableEquipment: [EquipmentType.BARBELL],
      injuries: ['knee'],
      sessionMinutes: 45,
      emphasis: ['chest'],
    });

    let captured = '';
    const deps: WorkoutGenDeps = {
      engine: {
        generateWorkoutPlan: async (p) => { captured = p.user; return validPlan; },
      },
    };
    await processGenerateWorkout(job.id, deps);

    // Barbell exercises kept, cable/machine-only exercises removed from the catalog.
    expect(captured).toContain('bench-barbell');
    expect(captured).not.toContain('facepull'); // cable
    expect(captured).not.toContain('leg-press'); // machine
    // Directives threaded through.
    expect(captured).toContain('knee');
    expect(captured).toContain('45');
    expect(captured).toContain('chest');
  });

  it('falls back to the full catalog when equipment filtering leaves too few exercises', async () => {
    await makeUser('gen-eq2');
    // Only 6 seeded cable exercises (< MIN_CATALOG of 8) → fall back to full catalog.
    const job = await createJob('gen-eq2', GenerationType.WORKOUT, {
      goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.INTERMEDIATE, daysPerWeek: 3,
      availableEquipment: [EquipmentType.CABLE],
    });

    let captured = '';
    const deps: WorkoutGenDeps = {
      engine: {
        generateWorkoutPlan: async (p) => { captured = p.user; return validPlan; },
      },
    };
    await processGenerateWorkout(job.id, deps);

    // Full catalog is used, so non-cable slugs are present again.
    expect(captured).toContain('bench-barbell');
    expect(captured).toContain('leg-press');
  });
});
