import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const ethanSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "marked_strike",
    name: "Marked Strike",

    bf: 70,
    evasionDebuff: 15,
    debuffDuration: 2,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Ethan doesn't waste a cut he hasn't already placed in his head. Deals physical contact damage, reducing the target's Evasion by ${this.evasionDebuff} for ${this.debuffDuration} turn(s).`;
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (arr[0]?.landed) {
        enemy.debuffStat({
          statName: "Evasion",
          amount: -this.evasionDebuff,
          duration: this.debuffDuration,
          context,
          statModifierSrc: user,
        });
      }

      return arr;
    },
  },

  {
    key: "choke_hold",
    name: "Choke Hold",

    bf: 30,
    snareDuration: 2,

    contact: true,
    damageMode: "standard",
    priority: 1,

    description() {
      return `He doesn't need the blade for this part — just leverage and patience. Deals physical contact damage, Snaring the target for ${this.snareDuration} turn(s).`;
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "executioners_ledger",
    name: "Executioner's Ledger",

    bf: 130,
    clayBonusPercent: 20,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 50,
    priority: 0,

    description() {
      return `Every debt gets collected eventually — Ethan just keeps the books. Deals physical contact damage, striking with an extra ${this.clayBonusPercent}% force if Clay is fighting at his side.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const clayAtSide = context.aliveChampions?.some(
        (c) =>
          c.team === user.team &&
          (c.championKey === "clay" || c.championKey === "clay_godslayer"),
      );
      const effectiveBf = this.bf + (clayAtSide ? this.clayBonusPercent : 0);
      const baseDamage = (user.Attack * effectiveBf) / 100;

      return new DamageEvent({
        baseDamage,
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

export default ethanSkills;
