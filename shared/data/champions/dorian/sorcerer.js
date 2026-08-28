const SPELLCASTER_CLASSES = new Set(["mage", "enchanter"]);

// A sorcerer learned outside magic through study; a magickin was born to it.
export function isSorcerer(champion) {
  if (!champion || !SPELLCASTER_CLASSES.has(champion.classKey)) return false;

  const species = Array.isArray(champion.species) ? champion.species : [];
  return !species.includes("magickin");
}
