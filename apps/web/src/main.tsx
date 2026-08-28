import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/styles/tokens.css';
import { initI18n } from './i18n';
import { initFirebase } from './lib/firebase';
import { configureApi } from './lib/api';
import { useAuthStore, getAuthToken } from './store/authStore';
import { useLocaleStore } from './store/localeStore';

initI18n(useLocaleStore.getState().locale);
initFirebase();
configureApi({
  getToken: getAuthToken,
  onUnauthorized: () => useAuthStore.getState().refreshToken(),
});
void useAuthStore.getState().bootstrap();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
