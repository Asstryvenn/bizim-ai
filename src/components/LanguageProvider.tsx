"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isLanguage, type Language } from "@/lib/i18n";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

// Тонкий Context поверх i18next: хранит ТОЛЬКО текущий выбранный язык
// и синхронизирует его с i18n.changeLanguage() + localStorage.
// Сам перевод строк по-прежнему делает библиотека (react-i18next / useTranslation).
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage должен использоваться внутри <LanguageProvider>");
  return ctx;
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  // Первый рендер всегда идёт с DEFAULT_LANGUAGE (localStorage недоступен на сервере),
  // поэтому восстанавливаем сохранённый язык уже после маунта — тот же паттерн,
  // что и в ThemeToggle для темы оформления.
  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(saved) && saved !== language) {
      setLanguageState(saved);
      i18n.changeLanguage(saved);
      document.documentElement.lang = saved;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // localStorage недоступен (приватный режим и т.п.) — не критично
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LanguageContext.Provider>
  );
}
