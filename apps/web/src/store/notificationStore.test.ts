import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DevicePlatform } from '@gigaflow/shared';
import { useNotificationStore, type NotificationDeps } from './notificationStore';

const deps: NotificationDeps = {
  getMessagingToken: async () => 'fcm1',
  deleteMessagingToken: async () => {},
  registerDeviceToken: async () => ({
    id: 'd',
    userId: 'u',
    token: 'fcm1',
    platform: DevicePlatform.WEB,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  deleteDeviceToken: async () => ({ deleted: true }),
};

// This environment's Node + jsdom combo does not reliably expose a working
// window.localStorage (Node's experimental global `localStorage` shadows
// jsdom's Storage implementation and resolves to `undefined`). Stub a
// minimal in-memory Storage so the store's localStorage read/write paths
// are exercised deterministically, independent of that environment quirk.
function makeFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  useNotificationStore.setState({ status: 'idle', token: undefined, error: undefined });
  vi.stubGlobal('localStorage', makeFakeStorage());
});

describe('notificationStore', () => {
  it('enable registers a token and becomes enabled', async () => {
    await useNotificationStore.getState().enable(deps);
    const s = useNotificationStore.getState();
    expect(s.status).toBe('enabled');
    expect(s.token).toBe('fcm1');
    expect(window.localStorage.getItem('gf.fcmToken')).toBe('fcm1');
  });

  it('enable with denied permission becomes denied', async () => {
    await useNotificationStore.getState().enable({ ...deps, getMessagingToken: async () => null });
    expect(useNotificationStore.getState().status).toBe('denied');
  });

  it('disable clears the token', async () => {
    await useNotificationStore.getState().enable(deps);
    await useNotificationStore.getState().disable(deps);
    const s = useNotificationStore.getState();
    expect(s.status).toBe('idle');
    expect(s.token).toBeUndefined();
    expect(window.localStorage.getItem('gf.fcmToken')).toBeNull();
  });

  it('enable sets error status when a dep throws', async () => {
    await useNotificationStore.getState().enable({
      ...deps,
      getMessagingToken: async () => {
        throw new Error('boom');
      },
    });
    const s = useNotificationStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('boom');
  });
});
