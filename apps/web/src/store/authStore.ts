import { create } from 'zustand';
import type { User } from '@gigaflow/shared';
import { postAuthSession } from '../lib/api';

export type AuthStatus = 'loading' | 'guest' | 'user' | 'error';

export interface AuthDeps {
  ensureSignedIn: () => Promise<string>;
  getIdToken: () => Promise<string>;
  postAuthSession: () => Promise<User>;
  linkGoogle: () => Promise<void>;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
}

// Firebase-backed defaults are resolved lazily via dynamic import, so that
// merely importing this module (e.g. from a test) never loads/evaluates the
// real `firebase/app` + `firebase/auth` SDK. `../lib/api`'s postAuthSession
// is safe to import statically — api.ts never initializes firebase.
const defaultDeps: AuthDeps = {
  ensureSignedIn: async () => (await import('../lib/firebase')).ensureSignedIn(),
  getIdToken: async () => (await import('../lib/firebase')).getIdToken(),
  postAuthSession,
  linkGoogle: async () => (await import('../lib/firebase')).linkGoogle(),
  linkEmailPassword: async (email: string, password: string) =>
    (await import('../lib/firebase')).linkEmailPassword(email, password),
};

export interface AuthState {
  status: AuthStatus;
  uid?: string;
  token?: string;
  user?: User;
  isGuest: boolean;
  bootstrap: (deps?: AuthDeps) => Promise<void>;
  refreshToken: (deps?: AuthDeps) => Promise<void>;
  upgradeGoogle: (deps?: AuthDeps) => Promise<void>;
  upgradeEmail: (email: string, password: string, deps?: AuthDeps) => Promise<void>;
}

/**
 * bootstrap/refreshToken sequencing note: `postAuthSession` (from api.ts)
 * takes no token argument — it relies on the api client's injected token
 * getter (`getAuthToken` below, wired via `configureApi` in main.tsx). So we
 * MUST write the freshly-fetched token into the store BEFORE calling
 * `postAuthSession`, otherwise the api client would send a stale/missing
 * bearer token.
 */
async function syncSession(deps: AuthDeps, set: (partial: Partial<AuthState>) => void): Promise<void> {
  set({ status: 'loading' });
  const uid = await deps.ensureSignedIn();
  const token = await deps.getIdToken();
  // Set token first so any token getter reading from this store (e.g. the
  // api client's configured getToken) sees it before postAuthSession fires.
  set({ uid, token });
  const user = await deps.postAuthSession();
  set({
    status: user.isGuest ? 'guest' : 'user',
    uid,
    token,
    user,
    isGuest: user.isGuest,
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  uid: undefined,
  token: undefined,
  user: undefined,
  isGuest: false,

  bootstrap: async (deps = defaultDeps) => {
    try {
      await syncSession(deps, set);
    } catch {
      set({ status: 'error' });
    }
  },

  refreshToken: async (deps = defaultDeps) => {
    try {
      const token = await deps.getIdToken();
      set({ token });
    } catch {
      set({ status: 'error' });
    }
  },

  upgradeGoogle: async (deps = defaultDeps) => {
    try {
      await deps.linkGoogle();
      await syncSession(deps, set);
    } catch {
      set({ status: 'error' });
    }
  },

  upgradeEmail: async (email: string, password: string, deps = defaultDeps) => {
    try {
      await deps.linkEmailPassword(email, password);
      await syncSession(deps, set);
    } catch {
      set({ status: 'error' });
    }
  },
}));

export function getAuthToken(): string | undefined {
  return useAuthStore.getState().token;
}
