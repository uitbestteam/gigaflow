import { describe, it, expect } from 'vitest';
import type { User } from '@gigaflow/shared';
import { AuthProvider, AuthSource, Language } from '@gigaflow/shared';
import { useAuthStore, getAuthToken, type AuthDeps } from './authStore';

const baseUser: User = {
  authId: 'uid_1',
  authSource: AuthSource.FIREBASE,
  authProvider: AuthProvider.ANONYMOUS,
  isGuest: true,
  timezone: 'Asia/Ho_Chi_Minh',
  language: Language.EN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const deps: AuthDeps = {
  ensureSignedIn: async () => 'uid_1',
  getIdToken: async () => 'tok_1',
  postAuthSession: async () => baseUser,
  linkGoogle: async () => {},
  linkEmailPassword: async () => {},
};

describe('authStore', () => {
  it('bootstrap resolves a guest', async () => {
    await useAuthStore.getState().bootstrap(deps);
    const s = useAuthStore.getState();
    expect(s.status).toBe('guest');
    expect(s.token).toBe('tok_1');
    expect(s.isGuest).toBe(true);
    expect(s.uid).toBe('uid_1');
    expect(getAuthToken()).toBe('tok_1');
  });

  it('bootstrap error sets error status', async () => {
    await useAuthStore.getState().bootstrap({
      ...deps,
      ensureSignedIn: async () => {
        throw new Error('x');
      },
    });
    expect(useAuthStore.getState().status).toBe('error');
  });

  it('upgradeGoogle links google, refreshes token, and updates user to non-guest', async () => {
    await useAuthStore.getState().bootstrap(deps);

    let linkGoogleCalled = false;
    await useAuthStore.getState().upgradeGoogle({
      ...deps,
      linkGoogle: async () => {
        linkGoogleCalled = true;
      },
      getIdToken: async () => 'tok_2',
      postAuthSession: async () => ({
        ...baseUser,
        authProvider: AuthProvider.GOOGLE,
        isGuest: false,
      }),
    });

    const s = useAuthStore.getState();
    expect(linkGoogleCalled).toBe(true);
    expect(s.status).toBe('user');
    expect(s.isGuest).toBe(false);
    expect(s.token).toBe('tok_2');
  });
});
