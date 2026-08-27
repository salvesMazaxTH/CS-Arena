// A duo is a champion-selection affordance, not a champion: one card that puts
// both of its cores into the line-up at once. It is deliberately absent from
// championDB, so the server rejects the duo key on sight.

const duoDB = {
  laisaelis_laiserisa: {
    key: "laisaelis_laiserisa",
    name: "Laisaelis & Laiserisa",
    portrait: "/assets/portraits/laisaelis_e_laiserisa.webp",
    cores: ["laisaelis", "laiserisa"],
  },
};

export function getDuoForCore(championKey) {
  return Object.values(duoDB).find((duo) => duo.cores.includes(championKey));
}

/** The duo a line-up broke apart by taking some of its cores but not all. */
export function findBrokenDuo(championKeys) {
  return Object.values(duoDB).find((duo) => {
    const taken = duo.cores.filter((coreKey) => championKeys.includes(coreKey));
    return taken.length > 0 && taken.length !== duo.cores.length;
  });
}

/**
 * Reads and edits a line-up array in terms of the duos inside it. Client and
 * server share it so the draft UI and the authoritative check cannot drift.
 */
export class DuoLayout {
  constructor(selection, teamSize) {
    this.selection = selection;
    this.teamSize = teamSize;
  }

  span(duo) {
    return duo.cores.length;
  }

  /** The duo occupying `index`, laid out in order, or null. */
  at(index) {
    const championKey = this.selection[index];
    if (!championKey) return null;

    const duo = getDuoForCore(championKey);
    if (!duo) return null;

    const start = index - duo.cores.indexOf(championKey);
    const laidOut = duo.cores.every(
      (coreKey, offset) => this.selection[start + offset] === coreKey,
    );

    return laidOut ? { duo, start } : null;
  }

  // A run is pinned to a multiple of its own length so the card never straddles
  // a row of the selection grid.
  canPlaceAt(duo, start) {
    const span = this.span(duo);
    if (start % span !== 0 || start + span > this.teamSize) return false;

    return duo.cores.every((coreKey, offset) => {
      const occupant = this.selection[start + offset];
      return occupant === null || occupant === coreKey;
    });
  }

  findPlacement(duo) {
    const span = this.span(duo);

    for (let start = 0; start + span <= this.teamSize; start += span) {
      const free = duo.cores.every(
        (_, offset) => this.selection[start + offset] === null,
      );
      if (free) return start;
    }

    return -1;
  }

  place(duo, start) {
    duo.cores.forEach((coreKey, offset) => {
      this.selection[start + offset] = coreKey;
    });
  }

  remove(duo) {
    duo.cores.forEach((coreKey) => {
      const index = this.selection.indexOf(coreKey);
      if (index > -1) this.selection[index] = null;
    });
  }

  /** The slot blocks a duo may occupy, e.g. "1-2, 3-4, 5-6, 7-8". */
  blockLabels(duo) {
    const span = this.span(duo);
    const labels = [];

    for (let start = 0; start + span <= this.teamSize; start += span) {
      labels.push(`${start + 1}-${start + span}`);
    }

    return labels.join(", ");
  }
}

export { duoDB };
