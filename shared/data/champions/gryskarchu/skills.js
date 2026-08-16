import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const gryskarchuSkills = [
  // =========================
  // Total Block (global)
  // =========================

  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "earthroot",
    name: "Earthroot",
    bf: 75,
    damageMode: "standard",
    rootDuration: 2,
    contact: false,

    priority: 0,

    description() {
      return `Deals damage to the chosen target and applies Rooted for ${this.rootDuration} turns.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      // Status effect only applies if the damage connects.
      if (!result?.evaded && !result?.immune) {
        const rooted = enemy.applyStatusEffect(
          "rooted",
          this.rootDuration,
          context,
        );
      }

      return result;
    },
  },

  {
    key: "vital_bloom",
    name: "Vital Bloom",
    healAmount: 40,
    contact: false,

    priority: 0,

    description() {
      return `Gryskarchu restores ${this.healAmount} HP to himself and all active allies.`;
    },

    targetSpec: ["all:ally"],

    resolve({ user, targets, context }) {
      let someoneHealed = false;

      for (const target of targets) {
        if (!target.alive) continue;
        if (target.team !== user.team) continue;

        target.heal(this.healAmount, context, user);
        someoneHealed = true;
      }

      return {
        log: someoneHealed
          ? `${formatChampionName(user)} invoked Vital Bloom.`
          : `${formatChampionName(user)} invoked Vital Bloom, but no one needed HP restored.`,
      };
    },
  },

  {
    // 30% Max HP restored, +25% Defense, 2-turn duration
    // Grants the effect to an ally.
    key: "mother_earths_protection",
    name: "Mother Earth's Protection",

    defBuff: 25,
    healPercent: 30,
    buffDuration: 2,
    defDamageBonus: 35,
    contact: false,
    isUltimate: true,
    momentumCost: 55,

    priority: 5,

    description() {
      return `Grants a chosen ally +${this.defBuff}% Defense for ${this.buffDuration} turns, restores ${this.healPercent}% of their Max HP, and grants them bonus damage equal to +${this.defDamageBonus}% of their Defense for ${this.buffDuration} turns.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;

      const healAmount =
        ally.maxHP * (this.healPercent / 100);

      ally.heal(healAmount, context, user);

      ally.modifyStat({
        statName: "Defense",
        amount: this.defBuff,
        duration: this.buffDuration,
        context,
        isPercent: true,
        statModifierSrc: user,
      });

      const bonus =
        ally.Defense * (this.defDamageBonus / 100);

      ally.addDamageModifier({
        id: "mother_earths_protection",
        expiresAtTurn:
          context.currentTurn + this.buffDuration,

        apply({ baseDamage, user }) {
          const total = baseDamage + bonus;
          return total;
        },
      });

      return {
        log:
          `${formatChampionName(user)} grants ${formatChampionName(
            ally,
          )} ${healAmount} HP restored, +${this.defBuff}% Defense, ` +
          `and bonus damage for ${this.buffDuration} turns!`,
      };
    },
  },
];

export default gryskarchuSkills;