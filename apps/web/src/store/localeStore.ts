import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n, { type SupportedLocale } from '../i18n';

export interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

/**
 * Persisted locale choice. Changing it also drives `i18next.changeLanguage`
 * so every translated string re-renders in the new language immediately.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => {
        set({ locale });
        void i18n.changeLanguage(locale);
      },
    }),
    { name: 'gigaflow-locale' },
  ),
);
