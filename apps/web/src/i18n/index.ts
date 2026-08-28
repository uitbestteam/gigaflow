import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import vi from './vi';

export const SUPPORTED_LOCALES = ['en', 'vi'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

let initialized = false;

/**
 * Initializes i18next once. Safe to call multiple times (e.g. across tests
 * and `main.tsx`) — subsequent calls are no-ops.
 */
export function initI18n(initialLocale: SupportedLocale = 'en'): typeof i18next {
  if (initialized) return i18next;
  initialized = true;

  void i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    lng: initialLocale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  return i18next;
}

export default i18next;
