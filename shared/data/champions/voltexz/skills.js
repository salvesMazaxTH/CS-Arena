import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const voltexzSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Skills
  // ========================

  {
    key: "twin_lightnings",
    name: "Twin Lightnings",

    bf: 40,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "lightning",

    description() {
      return `Voltexz fires a bolt of lightning from each hand at once, dealing Lightning magical damage to two chosen targets or to the same target twice.`;
    },

    targetSpec: [{ type: "enemy" }, { type: "enemy" }],

    resolve({ user, targets, context = {} }) {
      const [primary, secondary] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      if (primary) {
        const primaryResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: primary,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const primaryResults = Array.isArray(primaryResult)
          ? primaryResult
          : [primaryResult];

        results.push(...primaryResults);
      }

      if (secondary) {
        const secondaryResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: secondary,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const secondaryResults = Array.isArray(secondaryResult)
          ? secondaryResult
          : [secondaryResult];

        results.push(...secondaryResults);
      }

      return results;
    },
  },

  {
    key: "static_shock",
    name: "Static Shock",

    bf: 20,
    paralyzeDuration: 2,

    contact: false,
    damageMode: "standard",
    priority: 1,
    element: "lightning",

    description() {
      return `Voltexz discharges a crackling surge of electricity into the target, dealing damage and leaving them Paralyzed for ${this.paralyzeDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const damageArray = Array.isArray(damageResult)
        ? damageResult
        : [damageResult];

      results.push(...damageArray);

      const mainDamage = damageArray[0];

      // Paralysis only lands if the hit connected.
      // Its log is handled by the status effect system.
      if (
        !mainDamage?.evaded &&
        !mainDamage?.immune &&
        mainDamage?.totalDamage > 0
      ) {
        enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context);
      }

      return results;
    },
  },

  {
    key: "cataclysmic_discharge",
    name: "Cataclysmic Discharge",

    bf: 185,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "lightning",

    description() {
      return `Voltexz stops holding the current back and lets all of it go at once, burying the chosen target under a cataclysmic discharge of Lightning magical damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const damageResults = Array.isArray(damageResult)
        ? damageResult
        : [damageResult];

      results.push(...damageResults);

      return results;
    },
  },
];

export default voltexzSkills;
