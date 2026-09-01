import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const kaeldrathVulcanoSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Volcanic Slam
  // ========================

  {
    key: "volcanic_slam",
    name: "Volcanic Slam",
    bf: 60,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Kael'Drath brings a molten fist down on the chosen target, dealing physical damage.`;
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

      return result;
    },
  },

  // ========================
  // H2 — Magma Bomb
  // ========================
  {
    key: "magma_bomb",
    name: "Magma Bomb",
    bf: 70,
    burnDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,

    element: "fire",

    description() {
      return `Kael'Drath hurls a knot of molten rock at the chosen target, dealing Fire magical damage and leaving them Burning for ${this.burnDuration} turn(s).

      The blast splashes onto the enemy standing to their right, if there is one, dealing half of the damage effectively dealt to the main target.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      const primaryResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const primaryResults = Array.isArray(primaryResult)
        ? primaryResult
        : [primaryResult];
      const mainPrimaryDamage = primaryResults[0];

      results.push(...primaryResults);

      // The thrown rock is already ablaze, so it burns even on a grazing hit.
      if (effectConnected(mainPrimaryDamage, "burning", { ignoreDamageRequirement: true }))
        enemy.applyStatusEffect("burning", this.burnDuration, context);

      const [secondaryTarget] = context.getAdjacentChampions(enemy, {
        side: "right",
      });

      if (!secondaryTarget) return results;

      // The splash is half of the damage actually dealt to the main target.
      const splashDamage = (mainPrimaryDamage?.totalDamage ?? 0) / 2;

      const secondaryResult = new DamageEvent({
        baseDamage: splashDamage || 0,
        attacker: user,
        defender: secondaryTarget,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const secondaryResults = Array.isArray(secondaryResult)
        ? secondaryResult
        : [secondaryResult];
      results.push(...secondaryResults);

      return results;
    },
  },

  // ========================
  // Ultimate — Volcanic Destruction
  // ========================
  {
    key: "volcanic_destruction",
    name: "Volcanic Destruction",
    bf: 95,
    reductedDamagePercent: 30,

    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,

    contact: false,
    priority: 0,

    element: "fire",

    description() {
      return `The ground splits open and Kael'Drath lets the mountain speak, dealing Fire magical damage to EVERY champion on the field, allies included.

      Those attuned to Fire, Water or Earth stand within their own element and take only ${this.reductedDamagePercent}% of the damage.`;
    },

    targetSpec: ["all"],

    resolve({ user, targets, context }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      const targetList = Array.isArray(targets)
        ? targets
        : targets
          ? [targets]
          : [];

      for (let i = 0; i < targetList.length; i++) {
        const target = targetList[i];

        if (!target?.alive) continue;

        // Only Fire, Water or Earth affinities reduce the damage taken.
        const affinities = target.elementalAffinities || [];

        let finalBaseDamage = baseDamage;

        if (
          affinities.includes("fire") ||
          affinities.includes("water") ||
          affinities.includes("earth")
        )
          finalBaseDamage = baseDamage * (this.reductedDamagePercent / 100);

        const result = new DamageEvent({
          baseDamage: finalBaseDamage,
          attacker: user,
          defender: target,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        if (Array.isArray(result)) results.push(...result);
        else if (result) results.push(result);
      }

      return results;
    },
  },
];

export default kaeldrathVulcanoSkills;
