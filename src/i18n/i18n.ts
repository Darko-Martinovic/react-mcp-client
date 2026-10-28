import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files
import enTranslations from "./locales/en.json";
import frTranslations from "./locales/fr.json";
import nlTranslations from "./locales/nl.json";

const resources = {
  en: {
    translation: enTranslations,
  },
  fr: {
    translation: frTranslations,
  },
  nl: {
    translation: nlTranslations,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    debug: false,

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "mcp-client-language",
    },

    // Custom namespace separator to avoid conflicts
    nsSeparator: "::",
    keySeparator: ".",
  });

export default i18n;

// Helper function to get current language storage key
export const getLanguageStorageKey = (
  baseKey: string,
  language?: string
): string => {
  const currentLang = language || i18n.language || "en";
  return `${baseKey}_${currentLang}`;
};

// Helper function to migrate data between language storage keys
export const migrateToLanguageStorage = (
  baseKey: string,
  fromLang: string,
  toLang: string
) => {
  const fromKey = getLanguageStorageKey(baseKey, fromLang);
  const toKey = getLanguageStorageKey(baseKey, toLang);

  const data = localStorage.getItem(fromKey);
  if (data && !localStorage.getItem(toKey)) {
    localStorage.setItem(toKey, data);
  }
};

// Helper function to get all available languages
export const getAvailableLanguages = () => [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
];
