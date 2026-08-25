import { useMemo } from 'react';
import { TRANSLATIONS, DEFAULT_LANG } from './translations';

function interpolate(str: string, params?: Record<string, any>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
}

/**
 * Translation helper.
 * @param _lang  - ignored (English-only)
 * @param key     - translation key
 * @param params - {name}, {n} style placeholders
 */
export function translate(_lang: string | undefined, key: string, params?: Record<string, any>): string {
  const value = TRANSLATIONS.en[key] ?? key;
  return interpolate(value, params);
}

/**
 * Returns the active UI language.
 */
export function useLang(): string {
  return DEFAULT_LANG;
}

/**
 * Komponentlarda ishlatiladigan tarjima hook'i.
 * const t = useT();  t('home.ctaTitle')
 */
export function useT() {
  const lang = useLang();
  return useMemo(() => (key: string, params?: Record<string, any>) => translate(lang, key, params), [lang]);
}
