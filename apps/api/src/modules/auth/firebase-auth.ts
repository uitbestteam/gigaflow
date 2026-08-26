import type { MiddlewareHandler } from 'hono';
import type { User } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { mapSignInProvider } from './provider-map.js';
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

    const { authProvider, isGuest } = mapSignInProvider(verified.signInProvider);
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
