import { initializeApp, getApps, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { TokenVerifier, VerifiedToken } from '../modules/auth/firebase-auth.js';

let app: App | undefined;

function getApp(): App {
  if (!app) {
    app = getApps()[0] ?? initializeApp({ credential: applicationDefault() });
  }
  return app;
}

export function getFirebaseApp(): App {
  return getApp();
}

export const firebaseVerifier: TokenVerifier = async (token: string): Promise<VerifiedToken> => {
  const decoded = await getAuth(getApp()).verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name,
    signInProvider: decoded.firebase.sign_in_provider,
  };
};
