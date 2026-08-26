import { describe, it, expect } from 'vitest';
import { AuthProvider } from '@gigaflow/shared';
import { mapSignInProvider } from './provider-map';

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
