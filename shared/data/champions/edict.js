// Shared machinery for the Edicts of the brothers Avarik and Avarion.
//
// Both passives impose the same shape of law — "whatever is hollow enough is
// too hollow to wound" — and differ only in the stat each brother measures
// worth by (Avarik weighs HP, Avarion weighs Attack). The gating rules are
// identical on both sides, so they live here instead of being written twice.
//
// The two Edicts also cancel each other out: neither brother's law is in force
// while the other stands on the field, on either team.

export const AVARIK_NAME = "Avarik";
export const AVARION_NAME = "Avarion";

// Below these values on the measured stat, a champion is considered Hollow.
// The two Edicts sit at different thresholds because HP and Attack are not
// distributed the same way across the roster: HP is a pool that drains over
// the match, so Avarik's line is drawn high enough to be reachable in play,
// while Attack is mostly static, so Avarion's line is drawn low enough not to
// disqualify half the roster from the opening turn.
export const EDICT_HP_THRESHOLD = 225;
export const EDICT_ATTACK_THRESHOLD = 180;

// What a Hollow champion is allowed to deal per instance of damage.
export const EDICT_DAMAGE = 1;

/**
 * Normalizes the champion collection carried by a combat context.
 * `context.allChampions` is a Map of active champions, but some contexts only
 * expose the pre-filtered `aliveChampions` array.
 */
function listChampions(context) {
  const source = context?.allChampions ?? context?.aliveChampions;

  if (!source) return [];

  return source instanceof Map ? [...source.values()] : [...source];
}

/**
 * True when the other brother is standing on the field, regardless of team.
 */
export function isBrotherOnField(context, brotherName) {
  return listChampions(context).some(
    (champion) => champion?.alive && champion.name === brotherName,
  );
}

/**
 * Indirect damage is beneath an Edict's notice: damage over time and damage
 * that echoes from another source (reflects, thorns, nested reactions).
 *
 * The pipeline already refuses to run `onBeforeDmgTaking` on DoT and nested
 * damage — see `DamageEvent.canRunHook` — but a champion or effect carrying a
 * custom `combatHookPolicy` can lift that restriction, so the Edicts check for
 * it explicitly as well.
 */
export function isIndirectDamage(context) {
  return !!context?.isDot || Number(context?.damageDepth ?? 0) > 0;
}

/**
 * An Edict is in force only while its author is alive and his brother is not
 * on the field to annul it.
 */
export function isEdictInForce(owner, context, brotherName) {
  if (!owner?.alive) return false;

  return !isBrotherOnField(context, brotherName);
}

/**
 * A champion is Hollow when the stat the Edict measures has fallen below that
 * Edict's threshold. Current values are used, so buffs and debuffs move a
 * champion in and out of the Edict's reach.
 */
export function isHollow(champion, statName, threshold) {
  if (!champion) return false;

  const value = Number(champion[statName]);

  return Number.isFinite(value) && value < threshold;
}
