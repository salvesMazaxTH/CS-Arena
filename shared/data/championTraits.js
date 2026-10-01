// Champion species and elemental affinities: both are lists on the champion
// data, so every reader works off the list, normalized to lowercase.

/** Every species a champion belongs to, normalized to lowercase. */
export function getChampionSpeciesKeys(champion) {
  return (champion?.species ?? []).map((species) => species.trim().toLowerCase());
}

/** Whether a champion belongs to the given species. */
export function championHasSpecies(champion, species) {
  return getChampionSpeciesKeys(champion).includes(species.trim().toLowerCase());
}

/** Every elemental affinity a champion holds, normalized to lowercase. */
export function getChampionAffinityKeys(champion) {
  return (champion?.elementalAffinities ?? []).map((element) =>
    element.trim().toLowerCase(),
  );
}

/** Whether a champion holds the given elemental affinity. */
export function championHasAffinity(champion, element) {
  return getChampionAffinityKeys(champion).includes(element.trim().toLowerCase());
}
