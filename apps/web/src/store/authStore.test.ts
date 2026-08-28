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

  it('refreshToken updates the token without re-hitting postAuthSession', async () => {
    await useAuthStore.getState().bootstrap(deps);

    let postAuthSessionCalled = false;
    await useAuthStore.getState().refreshToken({
      ...deps,
      getIdToken: async () => 'tok_refreshed',
      postAuthSession: async () => {
        postAuthSessionCalled = true;
        return baseUser;
      },
    });

    const s = useAuthStore.getState();
    expect(s.token).toBe('tok_refreshed');
    expect(postAuthSessionCalled).toBe(false);
    expect(getAuthToken()).toBe('tok_refreshed');
  });

  it('refreshToken error sets error status', async () => {
    await useAuthStore.getState().bootstrap(deps);

    await useAuthStore.getState().refreshToken({
      ...deps,
      getIdToken: async () => {
        throw new Error('token fetch failed');
      },
    });

    expect(useAuthStore.getState().status).toBe('error');
  });

  it('upgradeEmail links email/password, refreshes session, and updates user to non-guest', async () => {
    await useAuthStore.getState().bootstrap(deps);

    let linkedEmail: string | undefined;
    let linkedPassword: string | undefined;
    await useAuthStore.getState().upgradeEmail('a@b.com', 'secret123', {
      ...deps,
      linkEmailPassword: async (email, password) => {
        linkedEmail = email;
        linkedPassword = password;
      },
      getIdToken: async () => 'tok_3',
      postAuthSession: async () => ({
        ...baseUser,
        authProvider: AuthProvider.PASSWORD,
        isGuest: false,
      }),
    });

    const s = useAuthStore.getState();
    expect(linkedEmail).toBe('a@b.com');
    expect(linkedPassword).toBe('secret123');
    expect(s.status).toBe('user');
    expect(s.isGuest).toBe(false);
    expect(s.token).toBe('tok_3');
  });

  it('upgradeEmail error sets error status', async () => {
    await useAuthStore.getState().bootstrap(deps);

    await useAuthStore.getState().upgradeEmail('a@b.com', 'secret123', {
      ...deps,
      linkEmailPassword: async () => {
        throw new Error('link failed');
      },
    });

    expect(useAuthStore.getState().status).toBe('error');
  });
});
