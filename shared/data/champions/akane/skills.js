import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const akaneSkills = [
  totalBlock,

  // ========================
  // Skill 1 — basic attack
  // ========================
  {
    key: "violet_slash",
    name: "Violet Slash",
    bf: 65,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    hitVfxPalette: "violet",
    priority: 0,

    description() {
      return `Akane unsheathes a single katana and draws it across the chosen target in one clean violet arc, the blade back at her hip before the cut is even felt, dealing damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  // ========================
  // Skill 2 — lifesteal
  // ========================
  {
    key: "bloodbath",
    name: "Bloodbath",
    lifeStealBuff: 95,
    buffDuration: 2,
    priority: 0,

    description() {
      return `Gains ${this.lifeStealBuff}% Life Steal for ${this.buffDuration} turn(s).`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      return {
        log: `${formatChampionName(user)} bathes in blood, gaining +${this.lifeStealBuff}% Life Steal for ${this.buffDuration} turn(s).`,
      };
    },
  },

  // ========================
  // Ultimate
  // ========================
  {
    key: "violet_onslaught",
    name: "Violet Onslaught",
    bf: 95,
    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",
    hitVfxPalette: "violet",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Akane draws both katanas and falls upon the chosen target in a furious, perfectly synchronized cadence, every cut and thrust flowing into the next like steps of a dance too fast to follow, dealing heavy damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default akaneSkills;
