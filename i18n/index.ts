import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import fr from './fr';
import en from './en';
import es from './es';

export const LANGUAGES = [
  { code: 'fr', label: 'Français',  flag: '🇫🇷' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
] as const;

export type LangCode = typeof LANGUAGES[number]['code'];

const STORAGE_KEY = '@hotelio_lang';

export async function getSavedLanguage(): Promise<LangCode | null> {
  try {
    const saved = await SecureStore.getItemAsync(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en' || saved === 'es') return saved;
  } catch {}
  return null;
}

export async function saveLanguage(code: LangCode) {
  try { await SecureStore.setItemAsync(STORAGE_KEY, code); } catch {}
}

function getDeviceLanguage(): LangCode {
  try {
    const locale = getLocales()[0]?.languageCode ?? 'fr';
    if (locale === 'en') return 'en';
    if (locale === 'es') return 'es';
  } catch {}
  return 'fr';
}

export async function changeLanguage(code: LangCode) {
  await i18n.changeLanguage(code);
  await saveLanguage(code);
}

let initialized = false;

export async function initI18n() {
  if (initialized) return;
  initialized = true;

  const saved   = await getSavedLanguage();
  const detected = getDeviceLanguage();
  const lng      = saved ?? detected;

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
        es: { translation: es },
      },
      lng,
      fallbackLng: 'fr',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
}

export default i18n;
