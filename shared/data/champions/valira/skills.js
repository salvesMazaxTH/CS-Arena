import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const valiraSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "groundshaker",
    name: "Groundshaker",

    bf: 55,
    stunDuration: 1,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `The impact alone knocks the fight out of most people — Valira never even needs to swing twice. Deals physical contact damage and always Stuns the chosen target for ${this.stunDuration} turn(s).`;
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

      if (effectConnected(arr[0], "stunned")) {
        enemy.applyStatusEffect("stunned", this.stunDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "unbending_blow",
    name: "Unbending Blow",

    bf: 80,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `No half-measures, no mitigating circumstances — just the full weight of the hammer arriving at once. Deals physical contact damage.`;
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "dragonbane",
    name: "Dragonbane",

    bf: 135,
    piercingPercentage: 40,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `The same blow that put a dragon in the dirt, brought down now on someone far less legendary. Deals physical contact damage, with ${this.piercingPercentage}% of it guaranteed to go through as piercing damage, Defense be damned.`;
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
        type: "physical",
        mode: "piercing",
        piercingPercentage: this.piercingPercentage,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default valiraSkills;
