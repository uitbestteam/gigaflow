import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCredential,
  signOut as firebaseSignOut,
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
  // Firebase restores the persisted session ASYNCHRONOUSLY on load. Without
  // waiting, `currentUser` is still null right after a reload and we'd sign in a
  // brand-new anonymous guest — silently discarding the user's real (Google/
  // email) session. Wait for the restore to settle before deciding.
  await a.authStateReady();
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
/**
 * Sign in / upgrade with Google. Returns the FORMER guest's ID token ONLY when
 * we had to sign into a pre-existing Google account (returning user) while a
 * guest with data was active — the caller uses it to merge that guest's data
 * into the account. Returns `undefined` for the in-place link (no merge needed).
 */
export async function linkGoogle(): Promise<string | undefined> {
  const a = getFirebaseAuth();
  const provider = new GoogleAuthProvider();

  // Always upgrade a guest IN PLACE (same uid → the API keeps their data). If
  // bootstrap hasn't produced a guest yet, create one first, so we NEVER fall
  // into a standalone Google sign-in that would orphan the current guest.
  if (!a.currentUser) {
    await signInAnonymously(a);
  }
  const guest = a.currentUser;
  if (!guest) throw new Error('No Firebase user to link');

  try {
    await linkWithPopup(guest, provider);
  } catch (err) {
    const code = (err as AuthError).code;
    // Returning user: this Google identity already owns an account, so it can't
    // be linked onto the current guest. Capture the guest token (to merge its
    // data), sign into the existing account, and hand the token back.
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
      const cred = GoogleAuthProvider.credentialFromError(err as AuthError);
      if (cred) {
        const guestToken = guest.isAnonymous ? await guest.getIdToken() : undefined;
        await signInWithCredential(a, cred);
        await a.currentUser?.getIdToken(true);
        return guestToken;
      }
    }
    throw err;
  }

  // Linking keeps the session's sign_in_provider as 'anonymous'; force a token
  // refresh so the fresh ID token carries the newly linked google.com identity,
  // which the API reads to flip the user from guest to a permanent account.
  await a.currentUser?.getIdToken(true);
  return undefined;
}

/** Sign out, then immediately re-establish a fresh anonymous guest session. */
export async function signOutUser(): Promise<void> {
  const a = getFirebaseAuth();
  await firebaseSignOut(a);
  await signInAnonymously(a);
}

/** The current Firebase user's photo URL / display name, if any (for the profile UI). */
export function currentUserProfile(): { photoURL?: string; displayName?: string; email?: string } {
  const u = getFirebaseAuth().currentUser;
  return {
    photoURL: u?.photoURL ?? undefined,
    displayName: u?.displayName ?? undefined,
    email: u?.email ?? undefined,
  };
}

export async function linkEmailPassword(email: string, password: string): Promise<void> {
  const a = getFirebaseAuth();
  if (!a.currentUser) {
    throw new Error('No signed-in Firebase user');
  }
  const credential = EmailAuthProvider.credential(email, password);
  await linkWithCredential(a.currentUser, credential);
  // Force-refresh so the new token carries the linked `email` identity (the
  // session's sign_in_provider stays 'anonymous' after linking).
  await a.currentUser.getIdToken(true);
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
