import { describe, it, expect } from 'vitest';
import { AuthProvider } from '@gigaflow/shared';
import { mapSignInProvider, resolveAuthIdentity } from './provider-map';

describe('mapSignInProvider', () => {
  it('maps anonymous', () => {
    expect(mapSignInProvider('anonymous')).toEqual({ authProvider: AuthProvider.ANONYMOUS, isGuest: true });
  });
  it('maps google.com', () => {
    expect(mapSignInProvider('google.com')).toEqual({ authProvider: AuthProvider.GOOGLE, isGuest: false });
  });
  it('maps password', () => {
    expect(mapSignInProvider('password')).toEqual({ authProvider: AuthProvider.PASSWORD, isGuest: false });
  });
  it('throws on unsupported provider', () => {
    expect(() => mapSignInProvider('facebook.com')).toThrow(/Unsupported sign-in provider/);
  });
});

describe('resolveAuthIdentity', () => {
  it('treats an anonymous session with a linked Google identity as a Google user (the link bug)', () => {
    expect(resolveAuthIdentity('anonymous', ['google.com'])).toEqual({
      authProvider: AuthProvider.GOOGLE,
      isGuest: false,
    });
  });
  it('treats an anonymous session with a linked email identity as a password user', () => {
    expect(resolveAuthIdentity('anonymous', ['email'])).toEqual({
      authProvider: AuthProvider.PASSWORD,
      isGuest: false,
    });
  });
  it('stays a guest when no real provider is linked', () => {
    expect(resolveAuthIdentity('anonymous', [])).toEqual({
      authProvider: AuthProvider.ANONYMOUS,
      isGuest: true,
    });
  });
  it('falls back to the sign-in provider for a fresh Google sign-in', () => {
    expect(resolveAuthIdentity('google.com', [])).toEqual({
      authProvider: AuthProvider.GOOGLE,
      isGuest: false,
    });
  });
  it('prefers Google when both google.com and email are linked', () => {
    expect(resolveAuthIdentity('anonymous', ['email', 'google.com'])).toEqual({
      authProvider: AuthProvider.GOOGLE,
      isGuest: false,
    });
  });
  it('throws (via fallback) on an unsupported provider with no linked identities', () => {
    expect(() => resolveAuthIdentity('facebook.com', [])).toThrow(/Unsupported sign-in provider/);
  });
});
