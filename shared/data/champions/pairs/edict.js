// Shared machinery for the Edicts of the brothers Avarik and Avarion. Both
// passives impose the same law — a champion too hollow on the measured stat
// deals only EDICT_DAMAGE per hit — and annul each other while both brothers
// stand on the field. They differ only in the stat: Avarik weighs HP, Avarion
// Attack.

export const AVARIK_NAME = "Avarik";
export const AVARION_NAME = "Avarion";

// Thresholds differ because HP drains over a match while Attack is near-static,
// so each line sits where it stays reachable without disqualifying the roster.
export const EDICT_HP_THRESHOLD = 225;
export const EDICT_ATTACK_THRESHOLD = 180;

// What a Hollow champion is allowed to deal per instance of damage.
export const EDICT_DAMAGE = 1;

// Some contexts expose only the pre-filtered `aliveChampions` array instead of
// the `allChampions` Map.
function listChampions(context) {
  const source = context?.allChampions ?? context?.aliveChampions;

  if (!source) return [];

  return source instanceof Map ? [...source.values()] : [...source];
}

// The other brother is on the field, on either team.
export function isBrotherOnField(context, brotherName) {
  return listChampions(context).some(
    (champion) => champion?.alive && champion.name === brotherName,
  );
}

// DoT and echoed/nested damage are beneath an Edict's notice. The pipeline
// already skips `onBeforeDmgTaking` for these, but a custom `combatHookPolicy`
// can lift that, so the Edicts also check explicitly.
export function isIndirectDamage(context) {
  return !!context?.isDot || Number(context?.damageDepth ?? 0) > 0;
}

export function isEdictInForce(owner, context, brotherName) {
  if (!owner?.alive) return false;

  return !isBrotherOnField(context, brotherName);
}

// Current stat value, so buffs and debuffs move a champion in and out of reach.
export function isHollow(champion, statName, threshold) {
  if (!champion) return false;

  const value = Number(champion[statName]);

  return Number.isFinite(value) && value < threshold;
}
