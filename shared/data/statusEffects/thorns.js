import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";

const ROMAN = ["", "I", "II", "III", "IV", "V"];

// Thorns is a power tier, not a pile of stacks: applying tier N to a bearer
// at tier M leaves it at min(maxTier, M + N), and it never decays. Every
// contact hit the bearer takes, killing blow included, returns a share of
// what got through (actualDmg + overkill) as Defense-ignoring damage.
const thorns = {
  key: "thorns",
  name: "Thorns",
  namePt: "Espinhos",
  type: "buff",
  subtypes: ["reactive"],
  maxTier: 5,
  // Share of the damage taken returned to the attacker, indexed by tier.
  returnPercentByTier: [0, 10, 15, 20, 25, 30],

  toRoman(tier) {
    return ROMAN[tier] ?? String(tier);
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
    const percent = this.returnPercentByTier[instance.tier] ?? 0;
    const returned = (taken * percent) / 100;
    if (returned <= 0) return;

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
        hitLog: (hit) => {
          const dmg = Math.floor(hit.damage);
          const target = formatChampionName(hit.defender);
          const bearer = formatChampionName(hit.attacker);
          const hp = `${hit.hpAfter}/${hit.defender.maxHP}`;
          return {
            en: `<b>[Thorns ${tier}]</b> ${target} is torn by ${bearer}'s thorns for ${dmg} damage\nfinal HP of ${target}: ${hp}`,
            pt: `<b>[Espinhos ${tier}]</b> ${target} é rasgado pelos espinhos de ${bearer} e sofre ${dmg} de dano\nHP final de ${target}: ${hp}`,
          };
        },
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
