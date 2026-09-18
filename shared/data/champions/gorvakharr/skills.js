import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const gorvakharrSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "chainforged_ambush",
    name: "Chainforged Ambush",

    bf: 60,
    snareDuration: 2,

    contact: true,
    damageMode: "standard",
    type: "physical",
    element: "fire",
    hitVfx: "slash",
    priority: 0,

    description() {
      return `Gorvakharr's burning chain lashes out and wraps around the chosen target. Deals physical damage and applies Snared for ${this.snareDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "cinderedge_slash",
    name: "Cinderedge Slash",

    bf: 70,
    snaredBonusBf: 30,
    burnDuration: 2,

    contact: true,
    damageMode: "standard",
    type: "physical",
    element: "fire",
    hitVfx: "multislash",
    priority: 0,

    description() {
      return `Gorvakharr drives his fire-wreathed blade into the chosen target, dealing physical damage and applying Burning for ${this.burnDuration} turn(s). If the target is <b>Snared</b>, this attack instead strikes with ${this.bf + this.snaredBonusBf} power.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const effectiveBf = enemy.hasStatusEffect("snared")
        ? this.bf + this.snaredBonusBf
        : this.bf;
      const baseDamage = (user.Attack * effectiveBf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "crimson_moon_harvest",
    name: "Crimson Moon Harvest",

    bf: 90,

    contact: true,
    damageMode: "standard",
    type: "physical",
    element: "fire",
    hitVfx: "multislash",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    executeThreshold: 0.25,
    executeFlatThreshold: 85,
    finishingType: "regular",

    description() {
      const percent = this.executeThreshold * 100;

      return `Gorvakharr drops on the chosen target under a crimson moon, chain and blade together. Deals heavy physical damage. Executes the target if they are critically wounded (≤ ${percent}% of their Max HP and ≤ ${this.executeFlatThreshold} HP).`;
    },

    finishingRule({ defender }) {
      const maxHP = defender?.maxHP;
      const currentHP = defender?.HP;

      if (!Number.isFinite(maxHP) || maxHP <= 0) {
        return this.executeThreshold;
      }

      if (!Number.isFinite(currentHP)) return;

      if (currentHP > this.executeFlatThreshold) return;

      return this.executeThreshold;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      if (!enemy) return;

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

export default gorvakharrSkills;
