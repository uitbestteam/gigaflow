// Firebase Cloud Messaging background service worker — TEMPLATE.
//
// This file is a static asset served from apps/web/public/ at
// /firebase-messaging-sw.js. It is independent of vite-plugin-pwa's
// generated service worker (registered separately by Firebase's
// `getMessagingToken`/`getToken` flow) and is NOT built or bundled by Vite:
// it is copied to the output as-is.
//
// IMPORTANT: this is a template. It will not deliver background push
// notifications until it is wired up with the project's real, public
// Firebase Web config (VITE_FIREBASE_API_KEY / VITE_FIREBASE_AUTH_DOMAIN /
// VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_APP_ID) and a VAPID key
// (VITE_FIREBASE_VAPID_KEY), matching apps/web/src/lib/firebase.ts.
// Service workers cannot read Vite's `import.meta.env` at runtime, so the
// config values below must be hardcoded (Firebase web config is public,
// non-secret) by infra as part of deploy configuration. Delivery is
// deferred to infra — this template only establishes the shape.
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

// gigaflow-dev public Firebase web config (non-secret). For a different
// deploy target (e.g. prod), substitute the matching project's values here.
firebase.initializeApp({
  apiKey: 'AIzaSyBtlVAEeS8v4N2RE1J_irl92flrCXxfBI0',
  authDomain: 'gigaflow-dev.firebaseapp.com',
  projectId: 'gigaflow-dev',
  messagingSenderId: '380948844114',
  appId: '1:380948844114:web:f626c14678d37f0c1a598b',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'GigaFlow';
  const options = {
    body: payload.notification && payload.notification.body,
    icon: '/icons/icon-192.png',
    data: payload.data,
  };
  self.registration.showNotification(title, options);
});
