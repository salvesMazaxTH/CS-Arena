/* import { CombatResolver } from "../../engine/combat/combatResolver.js"; */
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const voltexzSkills = [
  // ========================
  // Total block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Skills
  // ========================
  {
    key: "relampagos_gemeos",
    name: "Twin Lightnings",
    bf: 40,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "lightning",
    description() {
      return `Deals damage to up to two enemies (the same target can be chosen for both).`;
    },
    targetSpec: [{ type: "enemy" }, { type: "enemy" }],

    resolve({ user, targets, context = {} }) {
      const [primary, secondary] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      if (primary) {
        /* console.log(
          "🌊 ALL-CHAMPIONS DEBUG, allChampions in context (Voltexz 1st skill):",
          context?.allChampions,
        );
        */

        const primaryResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: primary,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();
        // console.log("🌊 Target affinities:", primary.elementalAffinities);
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
        // console.log("🌊 Target affinities:", secondary.elementalAffinities);
        const secondaryResults = Array.isArray(secondaryResult)
          ? secondaryResult
          : [secondaryResult];
        results.push(...secondaryResults);
      }

      return results;
    },
  },
  {
    key: "choque_estatico",
    name: "Static Shock",
    bf: 20,
    paralyzeDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 1,
    element: "lightning",
    description() {
      return `Deals damage (BF ${this.bf}) and leaves the target {paralyzed} for ${this.paralyzeDuration} turn(s), causing them to lose their next action.`;
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

      let paralyzed;

      console.log(
        "[Voltexz - Static Shock] DamageResult (mainDamage):",
        mainDamage,
        "mainDamage.totalDamage:",
        mainDamage?.totalDamage,
      );

      // Apply paralysis effect (only if the hit landed)
      if (
        !mainDamage?.evaded &&
        !mainDamage?.immune &&
        mainDamage?.totalDamage > 0
      ) {
        paralyzed = enemy.applyStatusEffect(
          "paralyzed",
          this.paralyzeDuration,
          context,
        );
      }

      if (paralyzed) {
        /* console.log(
          `${formatChampionName(enemy)} foi PARALISADO por Choque Estático e perderá sua próxima ação!`,
        );
        */
        // if (paralyzed && paralyzed.log && damageResult?.log) {
        //   damageResult.log += `\n${formatChampionName(enemy)} foi PARALISADO por Choque Estático e perderá sua próxima ação!`;
        // } else if (paralyzed && paralyzed.log) {
        //   damageResult.log = `${formatChampionName(enemy)} foi PARALISADO por Choque Estático e perderá sua próxima ação!`;
        // }
      }

      return results;
    },
  },

  {
    key: "descarga_cataclismica",
    name: "Cataclysmic Discharge",
    bf: 185,
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "lightning",
    description() {
      return `Deals massive damage to the enemy.`;
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
