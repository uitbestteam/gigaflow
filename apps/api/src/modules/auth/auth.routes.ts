import { Hono, type Context } from 'hono';
import { getAuth } from 'firebase-admin/auth';
import { apiSuccess } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { firebaseAuth, type TokenVerifier } from './firebase-auth.js';
import { mergeGuestData } from './merge.repo.js';
import { getFirebaseApp } from '../../lib/firebase.js';

export function makeAuthRoutes(deps: { verify: TokenVerifier }): Hono {
  const auth = new Hono();
  auth.use('*', firebaseAuth({ verify: deps.verify }));

  const handler = (c: Context) => c.json(apiSuccess(c.get('user')));
  auth.get('/session', handler);
  auth.post('/session', handler);

  /**
   * Merge a just-abandoned guest's data into the caller's (target) account.
   * Called by the web app when a returning user signs in with Google: their
   * Google identity already owns an account, so the fresh guest they built data
   * on can't be linked — we move that data onto their real account instead.
   *
   * Body: { guestToken } — a valid Firebase ID token for the guest. It proves
   * the caller owned that guest session. We refuse to "merge" a non-guest token.
   */
  auth.post('/merge', async (c) => {
    const target = c.get('user');
    if (target.isGuest) {
      return c.json(errorBody('Target account is still a guest'), 400);
    }

    let guestToken: unknown;
    try {
      guestToken = (await c.req.json<{ guestToken?: unknown }>()).guestToken;
    } catch {
      return c.json(errorBody('Invalid body'), 400);
    }
    if (typeof guestToken !== 'string' || guestToken.length === 0) {
      return c.json(errorBody('guestToken required'), 400);
    }

    let guest;
    try {
      guest = await deps.verify(guestToken);
    } catch {
      return c.json(errorBody('Invalid guest token'), 401);
    }

    // Only merge an actual guest (no linked real provider), and never into self.
    if ((guest.identities?.length ?? 0) > 0) {
      return c.json(errorBody('Source token is not a guest'), 400);
    }
    if (guest.uid === target.authId) {
      return c.json(apiSuccess(target));
    }

    const result = await mergeGuestData(guest.uid, target.authId);

    // Best-effort: remove the orphaned guest Firebase account. Never fail the
    // merge if this cleanup call errors.
    try {
      await getAuth(getFirebaseApp()).deleteUser(guest.uid);
    } catch {
      /* ignore */
    }

    return c.json(apiSuccess({ ...target, merged: result.totalMoved }));
  });

  return auth;
}
