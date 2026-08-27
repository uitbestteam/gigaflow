import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  linkWithPopup,
  linkWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function initFirebase(): FirebaseApp {
  if (app) return app;
  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  });
  return app;
}

function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(initFirebase());
  }
  return auth;
}

export async function ensureSignedIn(): Promise<string> {
  const a = getFirebaseAuth();
  if (a.currentUser) {
    return a.currentUser.uid;
  }
  const cred = await signInAnonymously(a);
  return cred.user.uid;
}

export async function getIdToken(): Promise<string> {
  const a = getFirebaseAuth();
  if (!a.currentUser) {
    throw new Error('No signed-in Firebase user');
  }
  return a.currentUser.getIdToken();
}

export async function linkGoogle(): Promise<void> {
  const a = getFirebaseAuth();
  if (!a.currentUser) {
    throw new Error('No signed-in Firebase user');
  }
  await linkWithPopup(a.currentUser, new GoogleAuthProvider());
}

export async function linkEmailPassword(email: string, password: string): Promise<void> {
  const a = getFirebaseAuth();
  if (!a.currentUser) {
    throw new Error('No signed-in Firebase user');
  }
  const credential = EmailAuthProvider.credential(email, password);
  await linkWithCredential(a.currentUser, credential);
}

export function onAuthChanged(cb: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}
