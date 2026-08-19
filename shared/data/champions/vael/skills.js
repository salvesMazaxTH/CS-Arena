import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../totalBlock.js";

const vaelSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================
  {
    key: "instantaneous_slash",
    name: "Instantaneous Slash",
    bf: 65,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Vael flashes forward in a swift slash, dealing damage to the enemy with a chance to land a critical hit.`;
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
    key: "piercing_lunge",
    name: "Piercing Lunge",
    bfPrimary: 55,
    bfSecondary: 60,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Vael lunges through the chosen target with a swift strike, dealing ${this.bfPrimary}% damage without critical hits. The enemy to the target's left is struck as well, if one exists, taking ${this.bfSecondary}% damage as a guaranteed critical hit.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [primary] = targets;

      const baseDamage = (user.Attack * this.bfPrimary) / 100;
      const results = [];

      const primaryResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: primary,
        skill: this,
        type: "physical",
        context,
        critOptions: { disable: true },
        allChampions: context?.allChampions,
      }).execute();

      const primaryResults = Array.isArray(primaryResult)
        ? primaryResult
        : [primaryResult];
      results.push(...primaryResults);

      const [secondaryTarget] = context.getAdjacentChampions(primary, {
        side: "left",
      });

      if (!secondaryTarget) return results;

      const secondaryResult = new DamageEvent({
        baseDamage: (user.Attack * this.bfSecondary) / 100,
        attacker: user,
        defender: secondaryTarget,
        skill: this,
        type: "physical",
        context,
        critOptions: { force: true },
        allChampions: context?.allChampions,
      }).execute();

      const secondaryResults = Array.isArray(secondaryResult)
        ? secondaryResult
        : [secondaryResult];
      results.push(...secondaryResults);

      return results;
    },
  },

  {
    key: "verdict_of_the_silent_edge",
    name: "Verdict of the Silent Edge",
    bf: 145,
    contact: true,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Vael delivers a devastating strike with his silent blade, dealing massive damage to the chosen target. If this attack kills the target, Vael scores points equal to his current Claim value.`;
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

      const didKill = Array.isArray(result)
        ? result.some((entry) => entry?.killed)
        : result?.killed;

      if (didKill) {
        const claimPoints =
          context.preActionClaimPoints ??
          getClaimPoints(user, context.currentTurn) ??
          0;

        if (claimPoints > 0) {
          context.registerScore({
            amount: claimPoints,
            scoringSlot: user.team - 1,
            reason: "verdict_of_the_silent_edge",
            sourceId: user.id,
          });
        }
      }

      return result;
    },
  },
];

export default vaelSkills;