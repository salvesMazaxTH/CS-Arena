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

/** True for a non-empty plain string or a { en, pt } bilingual pair. */
export function isLocalizedText(value) {
  if (typeof value === "string") return value.trim().length > 0;
  return (
    value != null &&
    typeof value === "object" &&
    (typeof value.en === "string" || typeof value.pt === "string")
  );
}
