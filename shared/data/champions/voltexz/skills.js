import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import unstableOvercharge from "./passive.js";

const editMode = false; // Enable to test Voltexz's recoil (deals 999 to herself).

// A fixed cut of the base damage a skill dispatched comes straight back on
// Voltexz as Absolute recoil, the moment the skill goes out — never dodged,
// never scaled by what the target absorbs. Depth 1 keeps it a nested event so it
// cannot recoil off itself.
function applyOverchargeRecoil({ user, baseDamage, context }) {
  const recoilDamage = editMode
    ? 999
    : Math.floor((baseDamage * unstableOvercharge.recoilPercent) / 100);
  if (recoilDamage <= 0) return [];

  context.registerDialog?.({
    message: `${formatChampionName(user)} is torn by her own current for ${recoilDamage} — <b>Unstable Overcharge</b>.`,
    sourceId: user.id,
    targetId: user.id,
  });

  const result = new DamageEvent({
    baseDamage: recoilDamage,
    attacker: user,
    defender: user,
    skill: {
      key: "unstable_overcharge_recoil",
      name: "Recoil (Unstable Overcharge)",
      suppressLog: true,
    },
    type: "magical",
    mode: DamageEvent.Modes.ABSOLUTE,
    context: { ...context, damageDepth: 1 },
    allChampions: context?.allChampions,
  }).execute();

  return Array.isArray(result) ? result : [result];
}

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
      let dispatchedBase = 0;

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
        dispatchedBase += baseDamage;
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
        dispatchedBase += baseDamage;
      }

      results.push(
        ...applyOverchargeRecoil({ user, baseDamage: dispatchedBase, context }),
      );

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

      results.push(...applyOverchargeRecoil({ user, baseDamage, context }));

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

      results.push(...applyOverchargeRecoil({ user, baseDamage, context }));

      return results;
    },
  },
];

export default voltexzSkills;
