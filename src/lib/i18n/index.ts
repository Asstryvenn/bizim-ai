"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./locales/ru/common.json";
import en from "./locales/en/common.json";

export const SUPPORTED_LANGUAGES = ["ru", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "ru";
export const LANGUAGE_STORAGE_KEY = "bizim:lang";

// i18next.init() один раз на процесс — при Fast Refresh модуль может
// переисполняться, поэтому защищаемся флагом isInitialized.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      ru: { common: ru },
      en: { common: en },
    },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      // React уже экранирует вывод — двойное экранирование не нужно.
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export function isLanguage(value: string | null): value is Language {
  return value === "ru" || value === "en";
}

export default i18n;
