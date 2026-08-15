import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const baraoEstrondosoSkills = [
  // ========================
  // Basic Attack
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "steel_impact",
    name: "Steel Impact",
    bf: 100,
    contact: true,
    damageMode: "standard",
    priority: -999,
    targetSpec: ["enemy"],

    description() {
      return `Deals damage to the chosen target.`;
    },

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

      if (result.totalDamage > 0 && user.runtime) {
        user.runtime.storedDamage = 0; // Resets Stored Damage after the attack
      }

      return result;
    },
  },

  {
    key: "reinforced_plating",
    name: "Reinforced Plating",
    contact: false,

    priority: -999,
    defenseBuff: 20,
    defBuffDuration: 2,

    description() {
      return `Increases Defense by ${this.defenseBuff} for ${this.defBuffDuration} turn(s).`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      /* user.applyStatusEffect("reinforced_plating", 2, context); */

      user.modifyStat({
        statName: "Defense",
        amount: this.defenseBuff,
        duration: this.defBuffDuration,
        context,
      });

      return {
        log: `${formatChampionName(user)} reinforced his plating!`,
      };
    },
  },

  {
    key: "super_hyper_ultra_mega_atomic_belly_flop",
    name: "Super Hyper Ultra Mega Atomic Belly Flop",
    bf: 730,
    contact: false,
    damageMode: "standard",
    priority: -999,

    isUltimate: true,
    momentumCost: 100,

    description() {
      return `Deals ABSURD damage to the target plus all Stored Damage. This attack is always a Critical Hit. After the attack, Stored Damage is reset to 0.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const storedDamage = user.runtime?.storedDamage || 0;
      const baseDamage = (user.Attack * this.bf) / 100 + storedDamage;

      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: { force: true },
        allChampions: context?.allChampions,
      }).execute();

      // Resets Stored Damage after the attack
      user.runtime.storedDamage = 0;

      return damageResult;
    },
  },
];

export default baraoEstrondosoSkills;
