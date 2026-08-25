import { useMemo } from 'react';
import { TRANSLATIONS, DEFAULT_LANG } from './translations.js';

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
}

/**
 * Translation helper. The app is English-only, so `lang` is ignored and we
 * always resolve from the English dictionary. The parameter is kept for
 * backwards compatibility with existing call sites.
 * @param {string} [lang]  - ignored (English-only)
 * @param {string} key     - translation key
 * @param {object} [params] - {name}, {n} style placeholders
 */
export function translate(lang, key, params) {
  const value = TRANSLATIONS.en[key] ?? key;
  return interpolate(value, params);
}

/**
 * Returns the active UI language. The app is English-only.
 */
export function useLang() {
  return DEFAULT_LANG;
}

/**
 * Komponentlarda ishlatiladigan tarjima hook'i.
 * const t = useT();  t('home.ctaTitle')
 */
export function useT() {
  const lang = useLang();
  return useMemo(() => (key, params) => translate(lang, key, params), [lang]);
}
