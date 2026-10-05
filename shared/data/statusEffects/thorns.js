import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { reactionLog } from "../../engine/combat/reactionLog.js";

const ROMAN = ["", "I", "II", "III", "IV", "V"];

// Thorns is a power tier, not a pile of stacks: applying tier N to a bearer
// at tier M leaves it at min(maxTier, M + N), and it never decays. Every
// contact hit the bearer takes, killing blow included, returns a base amount plus a
// share of what got through (actualDmg + overkill) as Defense-ignoring damage.
const thorns = {
  key: "thorns",
  name: "Thorns",
  namePt: "Espinhos",
  type: "buff",
  subtypes: ["reactive"],
  maxTier: 5,
  // Share of the damage taken returned to the attacker, indexed by tier.
  returnPercentByTier: [0, 10, 15, 20, 25, 30],
  // Added to every return on top of the share, so low tiers still bite.
  baseReturnDamage: 10,

  toRoman(tier) {
    return ROMAN[tier] ?? String(tier);
  },

  // The bearer's current tier; 0 when it has no Thorns.
  tierOf(champion) {
    return champion?.statusEffects?.get(this.key)?.tier ?? 0;
  },

  // Moves an existing bearer straight to the given tier, up or down; does
  // nothing to a champion without Thorns. Returns whether the tier changed.
  setTier(champion, tier) {
    const instance = champion?.statusEffects?.get(this.key);
    if (!instance) return false;
    const before = instance.tier;
    instance.tier = Math.min(this.maxTier, Math.max(1, tier));
    return instance.tier !== before;
  },

  // To a dispel every tier is a separate positive effect: stripping all of
  // them takes the Thorns off entirely.
  stripUnits(instance) {
    return instance.tier;
  },

  onStrip(champion, count) {
    const tier = this.tierOf(champion) - count;
    if (tier > 0) this.setTier(champion, tier);
    else champion.removeStatusEffect(this.key);
  },

  // Raises an existing bearer's tier; called by applyStatusEffect instead of
  // refusing a second application.
  reapply({ existingInstance, tierGain }) {
    const before = existingInstance.tier;
    existingInstance.tier = Math.min(this.maxTier, before + tierGain);
    return existingInstance.tier !== before;
  },

  // Called straight from the damage pipeline, not through emitCombatEvent:
  // Thorns answers the blow that kills its bearer, and fallen champions do
  // not receive combat events.
  onContactHit(event) {
    const defender = event.defender;
    const instance = defender?.statusEffects?.get(this.key);
    const attacker = event.attacker;
    if (!instance || !event.contact) return;
    if (!attacker?.alive || attacker === defender) return;

    const taken = (event.actualDmg || 0) + (event.overkill || 0);
    if (taken <= 0) return;
    const percent = this.returnPercentByTier[instance.tier] ?? 0;
    const returned = this.baseReturnDamage + (taken * percent) / 100;

    const tier = this.toRoman(instance.tier);
    event.context.extraDamageQueue ??= [];
    event.context.extraDamageQueue.push({
      baseDamage: returned,
      attacker: defender,
      defender: attacker,
      skill: {
        key: "thorns_return",
        name: this.name,
        contact: false,
        hitVfx: "thorn_prick",
        // One line with the damage in it, instead of the generic
        // "X used Thorns" line: the bearer did not act, the thorns did.
        hitLog: reactionLog(({ source, target, dmg }) => ({
          en: `<b>[Thorns ${tier}]</b> ${target} is torn by ${source}'s thorns for ${dmg} damage`,
          pt: `<b>[Espinhos ${tier}]</b> ${target} é rasgado pelos espinhos de ${source} e sofre ${dmg} de dano`,
        })),
      },
      type: "physical",
      mode: DamageEvent.Modes.PIERCING,
      piercingPercentage: 100,
      contact: false,
    });
  },

  createInstance({ owner, duration, context, metadata }) {
    const tier = Math.min(this.maxTier, Math.max(1, metadata?.stackCount ?? 1));
    return new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata: { ...metadata, tier },
      hooks: {
        name: this.name,
        type: this.type,
        subtypes: this.subtypes,
      },
    });
  },
};

export default thorns;
