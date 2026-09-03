// Team composition rules, shared by the team manager, the pre-match hub and the
// server. championDB and the emblem list are injected so this module stays
// decoupled from the data layer, the same way emblem eligibility is.

import { isChampionDraftable } from "../draftEligibility.js";
import { findBrokenDuo } from "../duos.js";
import { evaluateEmblemEligibilityForRoster } from "../emblems/eligibility.js";

export const TEAM_SIZE = 8;
export const MAX_TEAM_EMBLEMS = 2;

/**
 * @typedef {Object} Team
 * @property {string} id           Stable slug for prebuilt teams, a UUID for custom ones.
 * @property {string} name
 * @property {string[]} champions   Exactly TEAM_SIZE champion keys, in line-up order (duo cores inline).
 * @property {string[]} emblems     0..MAX_TEAM_EMBLEMS emblem keys.
 * @property {"prebuilt"|"custom"} origin
 * @property {string|null} [derivedFrom]  Prebuilt id this custom team was duplicated from.
 * @property {number} [updatedAt]
 */

/**
 * @param {Team} team
 * @param {{ championDB: Record<string, object>, emblems?: object[], editMode?: object }} deps
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateTeamComposition(
  team,
  { championDB = {}, emblems = [], editMode = {} } = {},
) {
  const errors = [];
  const champions = Array.isArray(team?.champions) ? team.champions : [];
  const emblemKeys = Array.isArray(team?.emblems) ? team.emblems : [];

  if (champions.length !== TEAM_SIZE || champions.some((key) => !key)) {
    errors.push(`A team needs exactly ${TEAM_SIZE} champions.`);
  }

  const seen = new Set();
  for (const key of champions) {
    if (!key) continue;
    if (seen.has(key)) errors.push(`Duplicate champion in the line-up: ${key}.`);
    seen.add(key);
    if (!isChampionDraftable(championDB[key], editMode)) {
      errors.push(`Champion cannot be drafted: ${key}.`);
    }
  }

  const brokenDuo = findBrokenDuo(champions.filter(Boolean));
  if (brokenDuo) {
    errors.push(
      `${brokenDuo.name} can only be taken together, never one without the other.`,
    );
  }

  if (emblemKeys.length > MAX_TEAM_EMBLEMS) {
    errors.push(`A team may carry at most ${MAX_TEAM_EMBLEMS} Emblems.`);
  }

  const rosterKeys = champions.filter(Boolean);
  for (const emblemKey of emblemKeys) {
    const emblem = emblems.find((entry) => entry.key === emblemKey);
    if (!emblem) {
      errors.push(`Unknown Emblem: ${emblemKey}.`);
      continue;
    }
    if (!evaluateEmblemEligibilityForRoster(emblem, rosterKeys, championDB)) {
      errors.push(`Emblem not eligible for this line-up: ${emblem.name}.`);
    }
  }

  return { ok: errors.length === 0, errors };
}
