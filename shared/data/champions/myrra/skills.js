import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../totalBlock.js";

const myrraSkills = [
  totalBlock,

  {
    key: "precision_cut",
    name: "Precision Cut",
    bf: 65,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    description() {
      return `Myrra slips her blade past the guard of the chosen target, dealing physical damage that ignores their damage reduction entirely.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      context = context || {};
      context.ignoreDamageReduction = true;

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

  {
    key: "bladedance",
    name: "Bladedance",
    hits: 2,
    bfPerHit: 40,
    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",
    priority: 0,

    description() {
      return `Myrra spins through the chosen target in two flowing cuts, dealing physical damage with each. Every hit feeds her passive.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      for (let i = 0; i < this.hits; i++) {
        const result = new DamageEvent({
          baseDamage: (user.Attack * this.bfPerHit) / 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(result);
      }

      return results;
    },
  },

  {
    key: "silent_execution",
    name: "Silent Execution",
    bf: 120,
    missingHpScaling: 0.5,
    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Myrra steps in without a sound and finishes what the battle started, dealing physical damage to the chosen target that grows with the HP they have already lost. Ignores damage reduction.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const missingHP = enemy.maxHP - enemy.HP;
      const bonus = missingHP * this.missingHpScaling;

      context = context || {};
      context.ignoreDamageReduction = true;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100 + bonus,
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

export default myrraSkills;
