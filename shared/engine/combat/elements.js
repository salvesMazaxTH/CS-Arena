// A skill or hit's `element` is either one element key or an array of them
// (a single blow that is several elements at once). Every reader goes
// through these helpers instead of comparing `element` directly.

export function elementsOf(element) {
  if (Array.isArray(element)) return element.filter(Boolean);
  return element ? [element] : [];
}

export function hasElement(element, key) {
  return elementsOf(element).includes(key);
}

// The element that leads a multi-element blow, for single-valued visual
// lookups (palettes, fallback animations).
export function primaryElement(element) {
  return elementsOf(element)[0] ?? null;
}
