// Champion classes: a champion may carry more than one, so every reader works
// off the list rather than a single key.

/** Every class key a champion holds, normalized to lowercase. */
export function getChampionClassKeys(champion) {
  const classKey = champion?.classKey;
  if (!classKey) return [];

  return (Array.isArray(classKey) ? classKey : [classKey]).map((key) =>
    key.trim().toLowerCase(),
  );
}

/** Whether a champion belongs to the given class, dual-class included. */
export function championHasClass(champion, classKey) {
  return getChampionClassKeys(champion).includes(classKey.trim().toLowerCase());
}
