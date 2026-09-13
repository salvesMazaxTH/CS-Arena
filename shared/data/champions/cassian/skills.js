import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const cassianSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Living Blood
  // ========================
  {
    key: "living_blood",
    name: "Living Blood",

    shieldRatio: 0.45,
    attackBuff: 45,
    critBuff: 20,
    buffDuration: 2,

    contact: false,
    priority: 2,

    description(champion) {
      if (champion?.runtime?.cassianForm === "offense") {
        return `Cassian's blood thickens along his forearms into a razor edge: he gains +${this.attackBuff} Attack and +${this.critBuff}% Critical for ${this.buffDuration} turn(s).`;
      }

      return `Cassian calls his own blood to the surface, wrapping himself in a living, physical aura of protection: he gains a shield worth ${this.shieldRatio * 100}% of his Defense.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      if (user.runtime?.cassianForm === "offense") {
        user.modifyStat({
          statName: "Attack",
          amount: this.attackBuff,
          duration: this.buffDuration,
          context,
        });

        user.modifyStat({
          statName: "Critical",
          amount: this.critBuff,
          duration: this.buffDuration,
          context,
        });

        return {
          log: `${formatChampionName(user)} sharpens his blood claws, gaining +${this.attackBuff} Attack and +${this.critBuff}% Critical for ${this.buffDuration} turn(s)!`,
        };
      }

      const shieldAmount = Math.round(user.Defense * this.shieldRatio);
      user.addShield(shieldAmount, 0, context, "regular", {
        visualVariant: "blood",
      });

      return {
        log: `${formatChampionName(user)} wraps himself in living blood armor, gaining a ${shieldAmount}-point shield!`,
      };
    },
  },

  // ========================
  // H2 — Blood Lash
  // ========================
  {
    key: "blood_lash",
    name: "Blood Lash",

    defenseBf: 30,
    offenseBf: 55,
    slowAmount: 20,
    slowDuration: 2,
    bleedDuration: 2,

    damageMode: "standard",
    priority: 0,

    description(champion) {
      if (champion?.runtime?.cassianForm === "offense") {
        return `Cassian's hand hardens into a claw and tears into the target, dealing physical damage and setting them Bleeding for ${this.bleedDuration} turn(s).`;
      }

      return `A whip of living blood lashes out from Cassian's hand, dealing magical damage and slowing the target by ${this.slowAmount} Speed for ${this.slowDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const isOffense = user.runtime?.cassianForm === "offense";
      const bf = isOffense ? this.offenseBf : this.defenseBf;
      const baseDamage = (user.Attack * bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: isOffense ? "physical" : "magical",
        contact: isOffense,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const hitResults = Array.isArray(result) ? result : [result];
      const mainDamage = hitResults[0];

      if (isOffense) {
        if (effectConnected(mainDamage, "bleeding")) {
          enemy.applyStatusEffect("bleeding", this.bleedDuration, context);
        }
      } else if (effectConnected(mainDamage, "blood_lash_slow")) {
        enemy.modifyStat({
          statName: "Speed",
          amount: -this.slowAmount,
          duration: this.slowDuration,
          context,
          statModifierSrc: user,
        });
      }

      return hitResults;
    },
  },

  // ========================
  // Ultimate — Turn of the Tide
  // ========================
  {
    key: "turn_of_the_tide",
    name: "Turn of the Tide",

    bf: 65,
    bonusDamage: 60,
    bleedDuration: 3,
    shieldRatio: 0.5,

    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    priority: 1,

    description(champion) {
      if (champion?.runtime?.cassianForm !== "offense") {
        return `Cassian forces the tide early, his blood exploding outward into claws: he deals magical damage to the target with ${this.bonusDamage} bonus damage and sets them Bleeding for ${this.bleedDuration} turn(s), immediately turning to offense.`;
      }

      return `Cassian forces the tide early, calling his blood back into a living shield: he deals physical damage to the target, and if the strike lands, gains a shield worth ${this.shieldRatio * 100}% of his Max HP, immediately turning to defense.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const enteringOffense = user.runtime?.cassianForm !== "offense";
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: enteringOffense ? "magical" : "physical",
        contact: !enteringOffense,
        bonusDamage: enteringOffense ? this.bonusDamage : 0,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const hitResults = Array.isArray(result) ? result : [result];
      const mainDamage = hitResults[0];

      if (enteringOffense) {
        if (effectConnected(mainDamage, "bleeding")) {
          enemy.applyStatusEffect("bleeding", this.bleedDuration, context);
        }
      } else if (effectConnected(mainDamage, "turn_of_the_tide_shield")) {
        const shieldAmount = Math.round(user.maxHP * this.shieldRatio);
        user.addShield(shieldAmount, 0, context, "regular", {
          visualVariant: "blood",
        });
      }

      user.passive.flipForm(user, context);

      return hitResults;
    },
  },
];

export default cassianSkills;
