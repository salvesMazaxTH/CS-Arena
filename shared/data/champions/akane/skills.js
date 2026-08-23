import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../totalBlock.js";

const akaneSkills = [
  totalBlock,

  // ========================
  // Skill 1 — ataque padrão
  // ========================
  {
    key: "violet_slash",
    name: "Violet Slash",
    bf: 65,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    description() {
      return `Deals damage to the chosen target.`;
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
  // Skill 2 — lifesteal (forma correta)
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

      return null;
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
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Deals heavy damage to the chosen target.`;
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
