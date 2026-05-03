import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

const savedLanguage = localStorage.getItem('language');
const browserLang = navigator.language.startsWith('zh') ? 'zh' : 'en';
const defaultLang = savedLanguage || browserLang;

document.documentElement.lang = defaultLang;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh }
    },
    lng: defaultLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

export function changeLanguage(lang: string) {
  localStorage.setItem('language', lang);
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export function getCurrentLanguage(): string {
  return i18n.language;
}