import { DEFAULT_LOCALE, normalizeLocale } from "/shared/i18n/locale.js";

const STORAGE_KEY = "csa_locale";

export function getLocale() {
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function setLocale(locale) {
  const normalized = normalizeLocale(locale);
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Storage unavailable (private mode, etc.) - locale just won't persist.
  }
  document.dispatchEvent(new CustomEvent("localechange", { detail: normalized }));
  return normalized;
}
