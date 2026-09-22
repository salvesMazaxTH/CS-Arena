export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "pt"];

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

/** A narrative field is either a plain string (legacy/generic text, always
 *  English) or a { en, pt } pair. Either shape resolves through here. */
export function resolveText(text, locale = DEFAULT_LOCALE) {
  if (text == null || typeof text === "string") return text;
  return text[normalizeLocale(locale)] ?? text[DEFAULT_LOCALE] ?? "";
}
