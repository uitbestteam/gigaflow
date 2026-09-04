import { AuthProvider } from '@gigaflow/shared';

export function mapSignInProvider(signInProvider: string): { authProvider: AuthProvider; isGuest: boolean } {
  switch (signInProvider) {
    case 'anonymous':
      return { authProvider: AuthProvider.ANONYMOUS, isGuest: true };
    case 'google.com':
      return { authProvider: AuthProvider.GOOGLE, isGuest: false };
    case 'password':
      return { authProvider: AuthProvider.PASSWORD, isGuest: false };
    default:
      throw new Error(`Unsupported sign-in provider: ${signInProvider}`);
  }
}

/**
 * Resolve the effective auth identity from BOTH the session's sign-in provider
 * and the token's linked identities.
 *
 * When an anonymous guest links Google/email via `linkWithPopup`, Firebase keeps
 * the session's `sign_in_provider` as `'anonymous'` — only `firebase.identities`
 * reflects the newly linked provider. So a user who has any real provider linked
 * is NOT a guest, regardless of how the current session originally signed in.
 * We fall back to `mapSignInProvider` only when no real provider is linked.
 */
export function resolveAuthIdentity(
  signInProvider: string,
  identities: readonly string[],
): { authProvider: AuthProvider; isGuest: boolean } {
  if (identities.includes('google.com')) {
    return { authProvider: AuthProvider.GOOGLE, isGuest: false };
  }
  // Firebase lists the password provider under the `email` identity key.
  if (identities.includes('password') || identities.includes('email')) {
    return { authProvider: AuthProvider.PASSWORD, isGuest: false };
  }
  return mapSignInProvider(signInProvider);
}
