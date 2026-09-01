import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const orynSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "draw_the_sky_down",
    name: "Draw the Sky Down",

    tauntDuration: 2,
    damageReductionAmount: 12,
    damageReductionDuration: 2,

    contact: false,
    priority: 3,
    element: "lightning",

    description() {
      return `Oryn lifts the pins in his forearms and the air leans toward him. He Taunts two chosen enemies for ${this.tauntDuration} turn(s) and braces for the answer, gaining ${this.damageReductionAmount} Damage Reduction for ${this.damageReductionDuration} turn(s).`;
    },

    targetSpec: [
      { type: "enemy", unique: true },
      { type: "enemy", unique: true },
    ],

    resolve({ user, targets, context = {} }) {
      user.applyDamageReduction({
        amount: this.damageReductionAmount,
        duration: this.damageReductionDuration,
        source: this.key,
        context,
      });

      const logs = [];
      for (const enemy of targets) {
        if (!enemy?.alive) continue;
        const tauntLog = enemy.applyTaunt(user.id, this.tauntDuration, context);
        if (tauntLog) logs.push(tauntLog);
      }

      logs.unshift({
        log: `${formatChampionName(user)} uses <b>Draw the Sky Down</b> and braces, gaining ${this.damageReductionAmount} Damage Reduction.`,
      });
      return logs;
    },
  },

  {
    key: "earthing_lance",
    name: "Earthing Lance",

    defenseScaling: 55,
    paralyzeDuration: 2,

    contact: true,
    damageMode: "standard",
    priority: 1,
    element: "lightning",

    description() {
      return `Oryn drives a pin into the chosen enemy and lets the charge he has been carrying run down it, dealing Lightning magical damage equal to ${this.defenseScaling}% of his Defense and leaving them Paralyzed for ${this.paralyzeDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Defense * this.defenseScaling) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "sentence_of_the_sky_courts",
    name: "Sentence of the Sky-Courts",

    defenseScaling: 60,
    paralyzeDuration: 1,
    shieldAmount: 90,

    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    priority: 2,
    element: "lightning",

    description() {
      return `The pins in Oryn's body finish their work and the sky-courts hand down their sentence at once. Every enemy takes Lightning magical damage equal to ${this.defenseScaling}% of his Defense and, where it lands, is left Paralyzed for ${this.paralyzeDuration} turn(s), while Oryn stands under a ${this.shieldAmount} Shield.`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Defense * this.defenseScaling) / 100;
      const list = Array.isArray(targets) ? targets : targets ? [targets] : [];
      const results = [];

      for (const enemy of list) {
        if (!enemy?.alive) continue;

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const arr = Array.isArray(result) ? result : [result];
        results.push(...arr);

        if (effectConnected(arr[0], "paralyzed")) {
          enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context, {
            sourceId: user.id,
          });
        }
      }

      user.addShield(this.shieldAmount, 0, context);

      results.push({
        log: `${formatChampionName(user)} calls down <b>Sentence of the Sky-Courts</b> and stands under a ${this.shieldAmount} Shield.`,
      });
      return results;
    },
  },
];

export default orynSkills;
