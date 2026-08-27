import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../generic/totalBlock.js";

const brunoSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Frost Missile
  // ========================
  {
    key: "frost_missile",
    name: "Frost Missile",
    bf: 55,
    chillDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "ice",

    description() {
      return `Bruno hurls a shard of hard frost at the chosen target, dealing Ice magical damage and leaving them Chilled for ${this.chillDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (!result?.evaded && !result?.immune) {
        target.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return result;
    },
  },

  // ========================
  // H2 — Glacial Charge
  // ========================
  {
    key: "glacial_charge",
    name: "Glacial Charge",
    bf: 90,
    contact: true,
    damageMode: "standard",
    priority: 0,
    element: "ice",

    description() {
      return `Bruno closes the distance behind a wall of advancing ice and drives it into the chosen target, dealing Ice physical damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  // ========================
  // Ultimate — Blizzard
  // ========================
  {
    key: "blizzard",
    name: "Blizzard",
    bf: 120,
    chillDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    isUltimate: true,
    momentumCost: 55,
    element: "ice",

    description() {
      return `Bruno pulls the whole winter down onto the chosen target, dealing devastating Ice magical damage and leaving them Chilled for ${this.chillDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (!result?.evaded && !result?.immune) {
        target.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return result;
    },
  },
];

export default brunoSkills;
