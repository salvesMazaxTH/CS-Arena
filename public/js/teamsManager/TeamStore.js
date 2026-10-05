import { PREBUILT_TEAMS, TEAM_SIZE, MAX_TEAM_EMBLEMS } from "/shared/data/teams/index.js";
import { generateId } from "/shared/utils/id.js";
import { supabase } from "/js/auth/session.js";

// Pre-account storage, read once to offer moving old teams into the account.
const LEGACY_CUSTOM_KEY = "csa.teams.custom";
const legacyImportedKey = (userId) => `csa.teams.imported.${userId}`;

function teamFromRow(row) {
  return normalizeCustomTeam({
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    champions: row.champions,
    emblems: row.emblems,
    derivedFrom: row.derived_from,
    updatedAt: Number(row.updated_at),
  });
}

function rowFromTeam(team, userId) {
  return {
    id: team.id,
    user_id: userId,
    name: team.name,
    tagline: team.tagline,
    champions: team.champions,
    emblems: team.emblems,
    derived_from: team.derivedFrom,
    updated_at: team.updatedAt,
  };
}

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

/**
 * Account-backed store: prebuilt teams are read-only, custom ones are CRUD.
 * Reads are synchronous against an in-memory cache filled by `load()`; writes
 * update the cache at once and reach Supabase in the background, reporting
 * failures through `onSyncError`. Without an account (edit-mode auto login)
 * the cache simply lives for the page's lifetime.
 */
export class TeamStore {
  constructor() {
    this.userId = null;
    this.maxCustomTeams = 25;
    this.custom = [];
    this.selectedId = null;
    this.onSyncError = null;
  }

  /** Binds the store to an account and pulls its teams and selection. */
  async load(userId) {
    this.userId = userId ?? null;
    if (!this.userId || !supabase) return;

    const [teamsResult, profileResult] = await Promise.all([
      supabase.from("teams").select("*").eq("user_id", this.userId),
      supabase.from("profiles").select("selected_team_id").eq("id", this.userId).maybeSingle(),
    ]);
    if (teamsResult.error) throw teamsResult.error;
    if (profileResult.error) throw profileResult.error;

    this.custom = teamsResult.data.map(teamFromRow).filter(Boolean);
    this.selectedId = profileResult.data?.selected_team_id ?? null;
  }

  /** Teams saved in this browser before accounts existed, not yet imported. */
  getLegacyTeams() {
    if (!this.userId) return [];
    try {
      if (localStorage.getItem(legacyImportedKey(this.userId))) return [];
      const parsed = JSON.parse(localStorage.getItem(LEGACY_CUSTOM_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(normalizeCustomTeam).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /** Moves the legacy browser teams into the account; safe to call once per account. */
  async importLegacyTeams() {
    const legacy = this.getLegacyTeams();
    if (legacy.length === 0) return 0;

    const known = new Set(this.custom.map((team) => team.id));
    const fresh = legacy
      .filter((team) => !known.has(team.id))
      .slice(0, Math.max(0, this.maxCustomTeams - this.custom.length));
    if (fresh.length > 0) {
      const { error } = await supabase
        .from("teams")
        .insert(fresh.map((team) => rowFromTeam(team, this.userId)));
      if (error) throw error;
      this.custom.push(...fresh);
    }
    this.markLegacyHandled();
    return fresh.length;
  }

  markLegacyHandled() {
    try {
      localStorage.setItem(legacyImportedKey(this.userId), "1");
    } catch {
      /* storage unavailable — the offer may simply repeat */
    }
  }

  getPrebuilt() {
    return PREBUILT_TEAMS.map((team) => structuredClone(team));
  }

  getCustom() {
    return this.custom.map((team) => structuredClone(team)).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  isFull() {
    return this.custom.length >= this.maxCustomTeams;
  }

  getAll() {
    return [...this.getPrebuilt(), ...this.getCustom()];
  }

  getById(id) {
    return this.getAll().find((team) => team.id === id) || null;
  }

  getSelectedId() {
    return this.selectedId;
  }

  setSelectedId(id) {
    this.selectedId = id || null;
    this._sync(
      supabase
        ?.from("profiles")
        .update({ selected_team_id: this.selectedId })
        .eq("id", this.userId),
    );
  }

  /** Inserts or replaces a custom team by id; stamps origin and updatedAt.
   *  Returns null when a new team would exceed maxCustomTeams. */
  saveCustom(team) {
    const exists = this.custom.some((entry) => entry.id === team.id);
    if (!exists && this.isFull()) return null;

    const stamped = {
      id: team.id || generateId("team"),
      name: team.name,
      tagline: team.tagline ?? "",
      champions: [...team.champions],
      emblems: [...team.emblems],
      origin: "custom",
      derivedFrom: team.derivedFrom ?? null,
      updatedAt: Date.now(),
    };

    const index = this.custom.findIndex((entry) => entry.id === stamped.id);
    if (index >= 0) this.custom[index] = stamped;
    else this.custom.push(stamped);

    this._sync(supabase?.from("teams").upsert(rowFromTeam(stamped, this.userId)));
    return stamped;
  }

  deleteCustom(id) {
    this.custom = this.custom.filter((team) => team.id !== id);
    this._sync(supabase?.from("teams").delete().eq("id", id).eq("user_id", this.userId));
    if (this.selectedId === id) this.setSelectedId(null);
  }

  /** Copies any team (prebuilt or custom) into a fresh custom team. */
  duplicate(sourceId, name) {
    const source = this.getById(sourceId);
    if (!source) return null;

    return this.saveCustom({
      id: generateId("team"),
      name: name || `${source.name} (copy)`,
      tagline: source.tagline ?? "",
      champions: [...source.champions],
      emblems: [...source.emblems],
      derivedFrom:
        source.origin === "prebuilt" ? source.id : source.derivedFrom ?? null,
    });
  }

  /** Fire-and-forget persistence; a no-op without an account. */
  _sync(request) {
    if (!this.userId || !request) return;
    Promise.resolve(request)
      .then(({ error }) => {
        if (error) throw error;
      })
      .catch((error) => this.onSyncError?.(error));
  }
}
