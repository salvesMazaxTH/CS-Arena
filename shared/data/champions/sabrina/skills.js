import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const sabrinaSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "tidal_lance",
    name: "Tidal Lance",

    bf: 60,
    chillDuration: 2,

    contact: false,
    priority: 0,

    damageMode: "standard",
    element: "water",
    description() {
      return `Fires a concentrated lance of water at an enemy, dealing Water magical damage and applying Chilled for ${this.chillDuration} turn(s).`;
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

      if (effectConnected(result, "chilled")) {
        target.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return result;
    },
  },

  {
    key: "glacial_bind",
    name: "Glacial Bind",

    bf: 85,
    chilledBonusPercent: 25,
    freezeDuration: 1,

    contact: false,
    priority: 0,

    damageMode: "standard",
    element: "ice",
    description() {
      return `Conjures a mass of hardened ice around an enemy, dealing Ice magical damage. If the target is already Chilled, this deals ${this.chilledBonusPercent}% increased damage and the Chilled effect is consumed and replaced by Frozen for ${this.freezeDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const isChilled = target.hasStatusEffect("chilled");

      // The ice feeds on the Chilled it is about to consume.
      const chilledMultiplier = isChilled
        ? 1 + this.chilledBonusPercent / 100
        : 1;
      const baseDamage = (user.Attack * this.bf * chilledMultiplier) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "frozen") && isChilled) {
        target.applyStatusEffect("frozen", this.freezeDuration, context);
      }

      return result;
    },
  },

  {
    key: "deluge_of_winter",
    name: "Deluge of Winter",

    chillDuration: 2,
    freezeDuration: 1,

    contact: false,
    priority: 1,

    isUltimate: true,
    momentumCost: 55,

    damageMode: "standard",
    element: "water",

    hits: [
      { id: "wave", element: "water", type: "magical", bf: 65 },
      { id: "frost", element: "ice", type: "magical", bf: 65 },
    ],

    description() {
      return `Unleashes a massive wave that crashes into the target, dealing Water magical damage and applying Chilled for ${this.chillDuration} turn(s) (if not already Chilled). The wave then immediately freezes around the target, dealing Ice magical damage. If the target was already Chilled when the wave struck, the Ice hit consumes the Chilled effect and Freezes them for ${this.freezeDuration} turn(s) instead.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const wasChilledOnImpact = target.hasStatusEffect("chilled");

      const waterResult = SkillHits.run(this, "wave", { user, target, context });

      if (
        effectConnected(waterResult, "chilled") &&
        !wasChilledOnImpact &&
        target.alive
      ) {
        target.applyStatusEffect("chilled", this.chillDuration, context);
      }

      if (!target.alive) return [waterResult];

      const iceResult = SkillHits.run(this, "frost", { user, target, context });

      if (effectConnected(iceResult, "frozen") && wasChilledOnImpact) {
        target.applyStatusEffect("frozen", this.freezeDuration, context);
      }

      return [waterResult, iceResult];
    },
  },
];

export default sabrinaSkills;
