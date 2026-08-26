import { describe, it, expect } from 'vitest';
import { zUser, AuthProvider, AuthSource } from '../index';

const base = {
  authId: 'uid_123',
  authSource: AuthSource.FIREBASE,
  authProvider: AuthProvider.ANONYMOUS,
  isGuest: true,
  timezone: 'Asia/Ho_Chi_Minh',
  language: 'en',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('zUser', () => {
  it('accepts a minimal guest user', () => {
    expect(zUser.safeParse(base).success).toBe(true);
  });
  it('accepts a linked google user with email', () => {
    const r = zUser.safeParse({ ...base, authProvider: AuthProvider.GOOGLE, isGuest: false, email: 'a@b.com' });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown authProvider', () => {
    expect(zUser.safeParse({ ...base, authProvider: 'facebook' }).success).toBe(false);
  });
  it('rejects a bad language', () => {
    expect(zUser.safeParse({ ...base, language: 'fr' }).success).toBe(false);
  });
});
