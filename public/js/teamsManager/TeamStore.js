import { PREBUILT_TEAMS, TEAM_SIZE, MAX_TEAM_EMBLEMS } from "/shared/data/teams/index.js";

const CUSTOM_KEY = "csa.teams.custom";
const SELECTED_KEY = "csa.teams.selectedId";

/** Coerces a stored blob into the Team shape; returns null when unusable. */
function normalizeCustomTeam(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;

  return {
    id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Untitled team",
    tagline: typeof raw.tagline === "string" ? raw.tagline : "",
    champions: Array.isArray(raw.champions)
      ? raw.champions.slice(0, TEAM_SIZE).map((key) => (typeof key === "string" ? key : null))
      : [],
    emblems: Array.isArray(raw.emblems)
      ? raw.emblems.filter((key) => typeof key === "string").slice(0, MAX_TEAM_EMBLEMS)
      : [],
    origin: "custom",
    derivedFrom: typeof raw.derivedFrom === "string" ? raw.derivedFrom : null,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
}

/** localStorage-backed store: prebuilt teams are read-only, custom ones are CRUD. */
export class TeamStore {
  getPrebuilt() {
    return PREBUILT_TEAMS.map((team) => structuredClone(team));
  }

  getCustom() {
    let parsed;
    try {
      parsed = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCustomTeam)
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getAll() {
    return [...this.getPrebuilt(), ...this.getCustom()];
  }

  getById(id) {
    return this.getAll().find((team) => team.id === id) || null;
  }

  getSelectedId() {
    try {
      return localStorage.getItem(SELECTED_KEY) || null;
    } catch {
      return null;
    }
  }

  setSelectedId(id) {
    try {
      if (id) localStorage.setItem(SELECTED_KEY, id);
      else localStorage.removeItem(SELECTED_KEY);
    } catch {
      /* storage unavailable — selection just won't persist */
    }
  }

  /** Inserts or replaces a custom team by id; stamps origin and updatedAt. */
  saveCustom(team) {
    const stamped = {
      id: team.id || crypto.randomUUID(),
      name: team.name,
      tagline: team.tagline ?? "",
      champions: [...team.champions],
      emblems: [...team.emblems],
      origin: "custom",
      derivedFrom: team.derivedFrom ?? null,
      updatedAt: Date.now(),
    };

    const list = this.getCustom();
    const index = list.findIndex((entry) => entry.id === stamped.id);
    if (index >= 0) list[index] = stamped;
    else list.push(stamped);

    this._writeCustom(list);
    return stamped;
  }

  deleteCustom(id) {
    this._writeCustom(this.getCustom().filter((team) => team.id !== id));
    if (this.getSelectedId() === id) this.setSelectedId(null);
  }

  /** Copies any team (prebuilt or custom) into a fresh custom team. */
  duplicate(sourceId, name) {
    const source = this.getById(sourceId);
    if (!source) return null;

    return this.saveCustom({
      id: crypto.randomUUID(),
      name: name || `${source.name} (copy)`,
      tagline: source.tagline ?? "",
      champions: [...source.champions],
      emblems: [...source.emblems],
      derivedFrom:
        source.origin === "prebuilt" ? source.id : source.derivedFrom ?? null,
    });
  }

  _writeCustom(list) {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable or over quota — surfaced by the caller's re-read */
    }
  }
}
