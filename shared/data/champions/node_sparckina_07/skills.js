import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const nodeSparckina07Skills = [
  basicStrike,
  // ========================
  // Special Abilities
  // ========================

  {
    key: "sparkling_slash",
    name: "Sparkling Slash",
    bf: 70,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,
    element: "lightning",
    description() {
      return `Node-SPARCKINA-07 carves a live arc through the chosen target, dealing Lightning magical damage.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "radiant_rush",
    name: "Radiant Rush",
    speedBuff: 10,
    evasionPercent: 10, // Evasion gain, as a percentage of Speed
    contact: false,

    priority: 3,
    element: "lightning",
    description() {
      return `Node-SPARCKINA-07 overclocks its drive and blurs into motion, gaining +${this.speedBuff} Speed and Evasion equal to ${this.evasionPercent}% of its Speed.`;
    },
    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        isPermanent: true,
        context,
      });

      // Buff Evasion after Speed so the gain is based on the updated Speed.
      const evasionBuff = user.Speed * (this.evasionPercent / 100);

      user.modifyStat({
        statName: "Evasion",
        amount: evasionBuff,
        isPermanent: true,
        context,
      });

      return {
        log: `${formatChampionName(user)} surges into a radiant rush (+${this.speedBuff} Speed, +${evasionBuff} Evasion).`,
      };
    },
  },

  {
    // Ultimate
    key: "radiant_burst",
    name: "Radiant Burst",
    bf: 135,
    paralyzeDuration: 2,
    contact: true,
    damageMode: "standard",
    priority: 0,
    element: "lightning",

    isUltimate: true,
    momentumCost: 55,

    description() {
      return `Node-SPARCKINA-07 dumps its whole charge at once, blasting the chosen target with heavy Lightning magical damage and leaving them Paralyzed for ${this.paralyzeDuration} turn(s).`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
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

      if (effectConnected(result, "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context);
      }

      return result;
    },
  },
];

export default nodeSparckina07Skills;
