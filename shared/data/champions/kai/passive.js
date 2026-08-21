import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "kindled_fists",
  name: "Kindled Fists",
  flamingFistsDamage: 30,
  livingEmberBonusDamage: 40,
  burnDuration: 1,
  livingEmberBurnDuration: 2,

  description() {
    return `Kai's knuckles never fully cool. Whenever he deals damage with a Basic Strike, the heat lands with it as ${this.flamingFistsDamage} bonus piercing damage, and the target catches fire unless their element already knows the burn.

    Under Living Ember, nothing is spared: all of his attacks deal ${this.livingEmberBonusDamage} bonus damage and always apply Burning, whatever the target's elemental affinity.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, skill, damage }) {
    if (attacker !== owner) return;

    const isLivingEmber = owner.runtime?.fireStance === "livingEmber";

    if (!isLivingEmber && skill?.key !== "basic_strike") return;

    const bonus = isLivingEmber
      ? this.livingEmberBonusDamage
      : this.flamingFistsDamage;

    return {
      damage: damage + bonus,
    };
  },

  onAfterDmgDealing({ attacker, defender, owner, damage, context, skill }) {
    if (attacker !== owner) return;
    if (damage <= 0) return;
    if (!defender) return;

    const isLivingEmber = owner.runtime?.fireStance === "livingEmber";

    // Main gate: only Basic Strikes burn, unless Living Ember is up.
    if (!isLivingEmber && skill?.key !== "basic_strike") return;

    const affinities = defender.elementalAffinities ?? [];

    // Earth, Water and Fire affinities shrug off the ordinary heat.
    if (
      !isLivingEmber &&
      affinities.some((a) => ["earth", "water", "fire"].includes(a))
    ) {
      return;
    }

    const burnDuration = isLivingEmber
      ? this.livingEmberBurnDuration
      : this.burnDuration;

    defender.applyStatusEffect("burning", burnDuration, context, {
      source: owner.name,
    });

    return {
      log: `${formatChampionName(attacker)} sets ${formatChampionName(defender)} Burning.`,
    };
  },
};
