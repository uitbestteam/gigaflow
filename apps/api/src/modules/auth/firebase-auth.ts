import type { MiddlewareHandler } from 'hono';
import type { User } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { resolveAuthIdentity } from './provider-map.js';
import { upsertByAuthId } from './user.repo.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

export interface VerifiedToken {
  uid: string;
  email?: string;
  name?: string;
  signInProvider: string;
  /**
   * Provider ids linked to this account (keys of the token's
   * `firebase.identities`), e.g. `['google.com']`. Present even when the
   * session's `signInProvider` is still `'anonymous'` after a link. Optional
   * for backward compatibility with verifiers/tests that don't supply it.
   */
  identities?: string[];
}

export type TokenVerifier = (bearerToken: string) => Promise<VerifiedToken>;

export interface FirebaseAuthDeps {
  verify: TokenVerifier;
  upsert?: typeof upsertByAuthId;
}

export function firebaseAuth(deps: FirebaseAuthDeps): MiddlewareHandler {
  const upsert = deps.upsert ?? upsertByAuthId;
  return async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) return c.json(errorBody('Unauthorized'), 401);

    let verified: VerifiedToken;
    try {
      verified = await deps.verify(token);
    } catch {
      return c.json(errorBody('Unauthorized'), 401);
    }

    let authProvider: ReturnType<typeof resolveAuthIdentity>['authProvider'];
    let isGuest: boolean;
    try {
      ({ authProvider, isGuest } = resolveAuthIdentity(verified.signInProvider, verified.identities ?? []));
    } catch {
      return c.json(errorBody('Forbidden'), 403);
    }

    const user = await upsert({
      authId: verified.uid,
      authProvider,
      isGuest,
      email: verified.email,
      displayName: verified.name,
    });
    c.set('user', user);
    await next();
  };
}
