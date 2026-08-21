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
    element: "earth",
    rootDuration: 2,
    contact: false,

    priority: 0,

    description() {
      return `Gryskarchu calls the roots up through the ground beneath the chosen target, dealing Earth magical damage and holding them Rooted for ${this.rootDuration} turn(s).`;
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
        enemy.applyStatusEffect("rooted", this.rootDuration, context);
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
      return `Green light opens across the field like something in bloom, restoring ${this.healAmount} HP to Gryskarchu and every active ally.`;
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
      return `Gryskarchu lays Mother Earth's own protection over the chosen ally, restoring ${this.healPercent}% of their Max HP.

      For ${this.buffDuration} turn(s), they gain +${this.defBuff}% Defense, and the ground itself carries their blows: their attacks deal bonus damage equal to ${this.defDamageBonus}% of their Defense.`;
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

        apply({ baseDamage }) {
          return baseDamage + bonus;
        },
      });

      return {
        log:
          `${formatChampionName(user)} grants ${formatChampionName(
            ally,
          )} ${healAmount} restored HP, +${this.defBuff}% Defense ` +
          `and bonus damage for ${this.buffDuration} turn(s)!`,
      };
    },
  },
];

export default gryskarchuSkills;