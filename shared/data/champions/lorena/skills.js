import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../generic/totalBlock.js";

const lorenaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Tag, You're It
  // ========================
  {
    key: "tag_youre_it",
    name: "Tag, You're It",

    bf: 25,

    contact: false,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Lorena blows the chosen target a mocking little kiss down the barrel before she even fires: deals physical damage and marks them, so her next hit against them is guaranteed to be a critical hit.`;
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

      const hitResult = Array.isArray(result) ? result[0] : result;

      // The mark only sticks if the shot actually connects.
      if (!hitResult?.evaded && !hitResult?.immune) {
        enemy.runtime.lorenaMarkedBy = user;
      }

      return result;
    },
  },

  // ========================
  // H2 — Double Tap
  // ========================
  {
    key: "double_tap",
    name: "Double Tap",

    bfPerHit: 35,

    contact: false,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Lorena squeezes both triggers before the recoil from the first shot even settles, putting two rounds into the chosen target — each one rolls for its own critical hit.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bfPerHit) / 100;
      const results = [];

      for (let i = 0; i < 2; i++) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(...(Array.isArray(result) ? result : [result]));
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Last Laugh
  // ========================
  {
    key: "last_laugh",
    name: "Last Laugh",

    bf: 125,
    markedPiercingPercentage: 15,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Lorena decides the joke's over: she puts everything she's got into one shot, dealing heavy physical damage to the chosen target — and if they're already marked, the shot also ignores ${this.markedPiercingPercentage}% of their Defense.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const marked = enemy.runtime.lorenaMarkedBy === user;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        mode: marked ? "piercing" : "standard",
        piercingPercentage: marked ? this.markedPiercingPercentage : undefined,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default lorenaSkills;
