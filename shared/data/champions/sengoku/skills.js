import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const sengokuSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Abilities
  // ========================
  {
    key: "ravening_strike",
    name: "Ravening Strike",
    bf: 70,
    damageMode: "standard",
    contact: true,
    priority: 0,
    description() {
      return `Sengoku brings down a blow heavy with old fury, dealing physical damage to the chosen target.`;
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
    key: "dragonfire_bolt",
    name: "Dragonfire Bolt",
    bf: 45,
    contact: false,
    damageMode: "piercing",
    piercingPercentage: 50,
    priority: 0,
    element: "fire",

    description() {
      return `Sengoku fires from his hand a bolt of dragonfire that burns straight through armor, dealing Fire magical damage to the chosen target with ${this.piercingPercentage}% piercing.`;
    },

    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "primordial_awakening",
    name: "Primordial Awakening",
    duration: 3,
    transformInto: "sengoku_primordial",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    description() {
      return `Sengoku sheds the centuries and unfolds into his primordial draconic shape for ${this.duration} turn(s), replacing his skills, his passive and his stats.`;
    },
    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      context.requestChampionMutation?.({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.duration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      return {
        log: `${formatChampionName(user)} awakens his <b>Primordial Form</b> for ${this.duration} turn(s)!`,
      };
    },
  },
];

export default sengokuSkills;
