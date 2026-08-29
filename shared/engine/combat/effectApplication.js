import { StatusEffectsRegistry } from "../../data/statusEffects/effectsRegistry.js";

/**
 * Whether a DamageEvent result justifies applying `statusKey` alongside it.
 *
 * The hit must have connected (`landed`) — not evaded, immune, shield-blocked or
 * turned away by stealth. Effects that mark themselves `requiresDamage` also need
 * the strike to have dealt damage; a skill can waive that for a narrative
 * exception with `ignoreDamageRequirement`.
 */
export function effectConnected(
  result,
  statusKey,
  { ignoreDamageRequirement = false } = {},
) {
  if (!result?.landed) return false;
  if (ignoreDamageRequirement) return true;
  if (StatusEffectsRegistry[statusKey]?.requiresDamage !== true) return true;
  return (result.totalDamage ?? 0) > 0;
}
