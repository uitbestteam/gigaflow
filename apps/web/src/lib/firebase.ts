import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  signInWithCredential,
  onAuthStateChanged,
  linkWithPopup,
  linkWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
  type Auth,
  type AuthError,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let messaging: Messaging | undefined;

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

/**
 * Sign in / upgrade with Google.
 *
 * The app is anonymous-first, so the happy path LINKS Google to the current
 * guest (preserving their data). Two fallbacks keep it robust:
 *  - No guest yet → plain `signInWithPopup`.
 *  - The Google identity already belongs to another account (returning user):
 *    `linkWithPopup` throws `credential-already-in-use`/`email-already-in-use`;
 *    we recover the credential from the error and `signInWithCredential` into
 *    that existing account instead of failing.
 */
export async function linkGoogle(): Promise<void> {
  const a = getFirebaseAuth();
  const provider = new GoogleAuthProvider();

  if (!a.currentUser) {
    await signInWithPopup(a, provider);
    return;
  }

  try {
    await linkWithPopup(a.currentUser, provider);
  } catch (err) {
    const code = (err as AuthError).code;
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
      const cred = GoogleAuthProvider.credentialFromError(err as AuthError);
      if (cred) {
        await signInWithCredential(a, cred);
        return;
      }
    }
    throw err;
  }
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

async function getFirebaseMessaging(): Promise<Messaging> {
  if (!messaging) {
    messaging = getMessaging(initFirebase());
  }
  return messaging;
}

export async function getMessagingToken(vapidKey: string): Promise<string | null> {
  if (!(await isSupported())) {
    return null;
  }
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return null;
  }
  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messagingInstance = await getFirebaseMessaging();
  const token = await getToken(messagingInstance, { vapidKey, serviceWorkerRegistration });
  return token || null;
}

export function onForegroundMessage(cb: (payload: MessagePayload) => void): () => void {
  let unsubscribe: (() => void) | undefined;
  let cancelled = false;
  void getFirebaseMessaging().then((messagingInstance) => {
    if (cancelled) return;
    unsubscribe = onMessage(messagingInstance, cb);
  });
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function deleteMessagingToken(): Promise<void> {
  const messagingInstance = await getFirebaseMessaging();
  await deleteToken(messagingInstance);
}
