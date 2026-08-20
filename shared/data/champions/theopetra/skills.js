import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const theopetraSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

    {
      key: "petrium_strike",
      name: "Petrium Strike",
      bf: 70,
      damageMode: "standard",
      contact: true,
      priority: 0,

      description() {
        return `Theópetra closes in and strikes with her stone-forged body, dealing physical damage to the chosen target.`;
      },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
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
    key: "ancestral_wall",
    name: "Ancestral Wall",
    priority: 1,

    description() {
      return `Theópetra raises a barrier, increasing her Defense by 30% for 2 turns.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      return user.modifyStat({
        statName: "Defense",
        amount: 30,
        duration: 2,
        isPercent: true,
        context,
        statModifierSrc: "ancestral_wall",
      });
    },
  },

  {
    key: "earthshattering_judgment",
    name: "Earthshattering Judgment",
    bf: 85,

    damageMode: "standard",

    cannotBeEvaded: true,

    contact: false,

    isUltimate: true,
    momentumCost: 55,

    priority: 0,

    description() {
      return `Theópetra commands the earth itself to pass judgment upon all enemies, dealing massive damage to them. This attack cannot be evaded.`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of enemies) {
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
      }

      return results;
    },
  },
];

export default theopetraSkills;