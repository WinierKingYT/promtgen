import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { t as translate, type SupportedLocale } from '../../v4/i18n/dictionary.js';

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    localStorage.getItem('promtgen-locale') === 'en-US' ? 'en-US' : 'tr-TR'
  );

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale(next) {
      localStorage.setItem('promtgen-locale', next);
      document.documentElement.lang = next;
      setLocaleState(next);
    },
    t: (key, params) => translate(key, locale, params)
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}
