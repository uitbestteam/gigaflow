import { create } from 'zustand';
import { DevicePlatform, type DeviceToken, type RegisterDeviceTokenInput } from '@gigaflow/shared';
import { registerDeviceToken as apiRegisterDeviceToken, deleteDeviceToken as apiDeleteDeviceToken } from '../lib/api';

export type NotificationStatus = 'idle' | 'enabling' | 'enabled' | 'denied' | 'error' | 'disabling';

const FCM_TOKEN_KEY = 'gf.fcmToken';

export interface NotificationDeps {
  getMessagingToken: (vapidKey: string) => Promise<string | null>;
  deleteMessagingToken: () => Promise<void>;
  registerDeviceToken: (input: RegisterDeviceTokenInput) => Promise<DeviceToken>;
  deleteDeviceToken: (token: string) => Promise<{ deleted: boolean }>;
}

// Firebase-backed defaults are resolved lazily via dynamic import, so that
// merely importing this module (e.g. from a test) never loads/evaluates the
// real `firebase/app` + `firebase/messaging` SDK. `../lib/api`'s
// register/deleteDeviceToken are safe to import statically — api.ts never
// initializes firebase.
const defaultDeps: NotificationDeps = {
  getMessagingToken: async (vapidKey: string) => (await import('../lib/firebase')).getMessagingToken(vapidKey),
  deleteMessagingToken: async () => (await import('../lib/firebase')).deleteMessagingToken(),
  registerDeviceToken: apiRegisterDeviceToken,
  deleteDeviceToken: apiDeleteDeviceToken,
};

function readStoredToken(): string | undefined {
  try {
    return window.localStorage.getItem(FCM_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStoredToken(token: string): void {
  try {
    window.localStorage.setItem(FCM_TOKEN_KEY, token);
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(FCM_TOKEN_KEY);
  } catch {
    // ignore storage failures
  }
}

function readNotificationPermission(): NotificationPermission | undefined {
  try {
    return typeof Notification !== 'undefined' ? Notification.permission : undefined;
  } catch {
    return undefined;
  }
}

export interface NotificationState {
  status: NotificationStatus;
  token?: string;
  error?: string;
  enable: (deps?: NotificationDeps) => Promise<void>;
  disable: (deps?: NotificationDeps) => Promise<void>;
  init: (deps?: NotificationDeps) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  status: 'idle',
  token: undefined,
  error: undefined,

  enable: async (deps = defaultDeps) => {
    set({ status: 'enabling', error: undefined });
    try {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;
      const token = await deps.getMessagingToken(vapidKey);
      if (!token) {
        set({ status: 'denied' });
        return;
      }
      await deps.registerDeviceToken({ token, platform: DevicePlatform.WEB });
      writeStoredToken(token);
      set({ status: 'enabled', token });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },

  disable: async (deps = defaultDeps) => {
    set({ status: 'disabling', error: undefined });
    try {
      const token = readStoredToken();
      if (token) {
        await deps.deleteDeviceToken(token);
        await deps.deleteMessagingToken();
      }
      clearStoredToken();
      set({ status: 'idle', token: undefined });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },

  init: async (_deps = defaultDeps) => {
    try {
      const stored = readStoredToken();
      const permission = readNotificationPermission();
      if (permission === 'denied') {
        set({ status: 'denied', token: undefined });
        return;
      }
      if (stored && permission === 'granted') {
        set({ status: 'enabled', token: stored });
        return;
      }
      set({ status: 'idle', token: undefined });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
