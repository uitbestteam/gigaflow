import { Hono, type Context } from 'hono';
import { apiSuccess } from '@gigaflow/shared';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { buildSummary, buildPersonalRecords, buildVolumeByWeek } from './stats.service.js';
import { evaluateAwards } from './awards.js';

export function makeStatsRoutes(deps: { verify: TokenVerifier }): Hono {
  const stats = new Hono();
  stats.use('*', firebaseAuth({ verify: deps.verify }));

  stats.get('/summary', async (c: Context) => {
    const user = c.get('user');
    const summary = await buildSummary(user.authId);
    return c.json(apiSuccess(summary));
  });

  stats.get('/prs', async (c: Context) => {
    const user = c.get('user');
    const records = await buildPersonalRecords(user.authId);
    return c.json(apiSuccess(records));
  });

  stats.get('/volume-by-week', async (c: Context) => {
    const user = c.get('user');
    return c.json(apiSuccess(await buildVolumeByWeek(user.authId)));
  });

  stats.get('/awards', async (c: Context) => {
    const user = c.get('user');
    const summary = await buildSummary(user.authId);
    const awards = evaluateAwards(summary);
    return c.json(apiSuccess(awards));
  });

  return stats;
}
