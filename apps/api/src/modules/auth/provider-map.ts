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
