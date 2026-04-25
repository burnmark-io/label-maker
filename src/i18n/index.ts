import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import nl from './locales/nl.json';

export type SupportedLocale = 'en' | 'nl';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'nl'];

function detectInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem('burnmark.locale');
    if (stored === 'en' || stored === 'nl') return stored;
  } catch {
    // ignore — private mode etc.
  }
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  if (nav === 'nl') return 'nl';
  return 'en';
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    nl,
  },
});

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  try {
    window.localStorage.setItem('burnmark.locale', locale);
  } catch {
    // ignore
  }
}
