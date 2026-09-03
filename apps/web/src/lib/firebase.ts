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
